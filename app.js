const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const request = require('request')
var Intercom = require('intercom-client');

var client = new Intercom.Client({ token: process.env.INTERCOM_TOKEN });

// Use glitchup package to prevent server from sleeping
const glitchup = require('glitchup');
glitchup();

// use a web cron service, like https://cron-job.org or other, to hit an endpoint you define
// yep, that's it - so it'd be https://tickets.glitch.me/your-endpoint and it'd call that function.

// Express middleware for parsing request/resonse bodies
app.use(bodyParser.urlencoded({extended: false}));

app.get('/cron-'+process.env.CRON_KEY, function (req, res) {
  status(res,'notification');
})

// Important functions to re-write
// status() - default
// caseAttachment() - case link with ID
// emailSearch() - email address
// caseCard() - singe case message to send


// Elements for output message
const disqusRed = '#e76c35'
const disqusGreen = '#7fbd5a'
let statusIcon
let stats = ""

app.post('/', function (req, res) {
  // Check the slack token so that this request is authenticated
  if (req.body.token === process.env.SLACK_TOKEN) {
    // Detect which command was entered in slack and call the correct function
    if (req.body.text.length === 0) {
      status(res,'commandResponse')
    // validates a full Desk link
    } else if (/^[0-9]{1,7}$/.test(req.body.text.split('case/')[1])) {
      caseAttachment(req.body.text.split('case/')[1])
    // validates email
    } else if (/([\w\.]+)@([\w\.]+)\.(\w+)/.test(req.body.text)) {
      emailSearch(req.body.text)
    } else if (req.body.text === "help") {
      help()
    } else if (req.body.text === "test") {
      intercomTest()
    } else {
      res.send('Sorry bub, I\'m not quite following. Type `/support help` to see what I can understand.');
    }    
  } else {
    res.send(
      {
        "response_type": "ephemeral",
        "text": "Wow, such unauthorized",
      }
    )
  }
  
  // When given case ID, get and send all case, customer, and assigned user details to slack
  function caseAttachment(id) {
    desk.case(id, {}, function(error, data) {
      if (data !== null) {
        let caseData = data
        desk.customer(caseData._links.customer.href.split("customers/")[1], {}, function(error, data) {
          if (data !== null) {
            let customerData = data
            if (data !== null) {
              let assignedName = 'Nobody'
              if (caseData._links.assigned_user) {
                desk.user(caseData._links.assigned_user.href.split("users/")[1], {}, function(error, data) {
                  if (data) {
                    let attachment = caseCard(
                      null,
                      caseData.status,
                      caseData.id,
                      caseData.subject,
                      caseData.blurb,
                      caseData.labels.toString(),
                      Date.parse(caseData.received_at)/1000,
                      customerData.display_name,
                      customerData.company,
                      customerData.avatar,
                      data.public_name
                    )
                    res.send(
                      {
                        "response_type": "in_channel",
                        "attachments": [attachment],
                      }
                    )
                  }
                })
              } else {
                // function caseCard(text, status, id, subject, blurb, labels, ts, customer, company, customerGrav, assigned)
                let attachment = caseCard(
                  null,
                  caseData.status,
                  caseData.id,
                  caseData.subject,
                  caseData.blurb,
                  caseData.labels.toString(),
                  Date.parse(caseData.received_at)/1000,
                  customerData.display_name,
                  customerData.company,
                  customerData.avatar,
                  null
                )
                res.send(
                  {
                    "response_type": "in_channel",
                    "attachments": [attachment],
                  }
                );
              }
            } else {
              help()
            }
          } else {
            help()
          }
        })
      } else if (data._embedded.entries.length < 1) {
        empty()
      } else {
        help()
      }
    });
  }
  // Returns most recent case ids that matches email
  function emailSearch(email) {
    desk.get('cases/search/',{email: email, sort_field:'created_at', sort_direction: 'desc'}, function(error, data) {
      if (data._embedded.entries.length > 0) {
        caseAttachment(data._embedded.entries[0].id)
      } else if (data._embedded.entries.length < 1) {
        empty()
      } else {
        help()
      }
    });
  }
  
  // Returns a single case attachment using data from 
  function caseCard(text, status, id, subject, blurb, labels, ts, customer, company, customerGrav, assigned) {
    if (company) {
      company = "("+company+")"
    }
    if (!assigned) {
      assigned = "Nobody"
    }
    let attachement = {
      "pretext": status + " case from " + customer + " " + company,
      "fallback": status + " case from " + customer + " " + company + "- #" + id + ": "+ subject,
      "author_icon": customerGrav,
      "author_name":  customer + " " + company,
      "title": "#" + id + ": "+ subject,
      "title_link": "https://help.disqus.com/agent/case/"+id,
      "text": blurb,
      "fields": [
        {
          "title": "Assigned",
          "value": assigned,
          "short": true
        },
        {
          "title": "Labels",
          "value": labels,
          "short": true
        }
      ],
      "color": "#7CD197",
      "ts": ts
    }
    return attachement
  }
  
  // does something
  function uniqueMap(a, key) {
    let keysArray = [];
    let uniqueArray = [];
    a.forEach( obj => keysArray.push(obj[key]));
    a.forEach( obj => keysArray.indexOf(obj[key]) === keysArray.lastIndexOf(obj[key]) ? uniqueArray.push(obj) : console.log())
    return uniqueArray;
  }
  
  // Return intercomTest
  function intercomTest() {
    
    // client.conversations.list({ type: 'team', per_page: 20, open: true }, function (err, d) {
    client.conversations.list( { open: true, per_page: 50 }, function (err, d) {
      console.log(err, d, "😸 "+ JSON.stringify(d.body.conversations[0]))
      res.send(
        {
          "response_type": "ephemeral",
          "text": "hello"+Date.now(),
        }
      )
    })
  }
  
  // Return help text with examples
  function help() {
    res.send(
      {
        "response_type": "ephemeral",
        "text": "Type `/support` for status accross all filters. Add a case link `https://help.disqus.com/agent/case/347519` or an email `archon@gmail.com` to get specific.",
      }
    )
  }
  // Return error text when Desk fails
  function empty() {
    res.send(
      {
        "response_type": "ephemeral",
        "text": "Sorry, Desk give me any results :(",
      }
    )
  }
})

// Handle each command, and return relevant information to slack
// Return stats on all case filters from Desk
function status(res,type) {
    let dataEntries = []
    // Recursively call Desk until there are no more pages of results
    let i = 1
    function getOpenCases() {
      desk.cases({
        labels:['Priority publisher,SaaS Ads,Direct publisher,Community publisher,Home,Community commenter'], 
        status:['new,open'], 
        sort_field:'created_at', 
        sort_direction: 'asc',
        per_page:100, 
        page:i
      }, function(error, data) {
        if (i <= Math.ceil(data.total_entries/100)) {
          dataEntries = dataEntries.concat(data._embedded.entries)           
          i++
          getOpenCases()
        } else if (!data) {
          error()
        } else {
          filterSend(dataEntries)
        }
      });
    }
    getOpenCases()
  
    function getResolvedCases() {
          desk.get('cases',{
            labels:['Priority publisher,SaaS Ads,Direct publisher,Community publisher,Home,Community commenter'], 
            status:['resolved'], 
            sort_field:'created_at', 
            sort_direction: 'asc',
            per_page:100
          }, function(error, data) {
            if (!data) {
              error()
            } else {
            }
          });
        }
    
  //getResolvedCases()

    function filterSend(dataEntries) {
      createStats(dataEntries)
      slackSend()
    }

    // Filter the data into seprate objects that correspond to each Desk filter
    function createStats(dataEntries) {
      var priorityFilter = dataEntries.filter(function(caseObj){
        return caseObj.labels.includes('Priority publisher') && !caseObj.labels.includes('SaaS Ads')
      })
      var saasFilter = dataEntries.filter(function(caseObj){
        return caseObj.labels.includes('SaaS Ads') && !caseObj.labels.includes('Ad Content Report')
      })
      var directFilter = dataEntries.filter(function(caseObj){
        return caseObj.labels.includes('Direct publisher') && !caseObj.labels.includes('Channel commenter') && !caseObj.labels.includes('SaaS Ads')
      })
      var communityFilter = dataEntries.filter(function(caseObj){
        return caseObj.labels.includes('Community publisher') && !caseObj.labels.includes('Priority publisher') && !caseObj.labels.includes('SaaS Ads')
      })
      var channelFilter = dataEntries.filter(function(caseObj){
        return caseObj.labels.includes('Home')
      })
      var commenterFilter = dataEntries.filter(function(caseObj){
        return caseObj.labels.includes('Community commenter')
      })

      // New cases stats only for further segments
      var priorityNew = priorityFilter.filter(function(caseObj){
        return caseObj.status.includes('new')
      })
      var saasNew = saasFilter
      .filter(function(caseObj){
        return caseObj.status.includes('new')
      })
      var directNew = directFilter.filter(function(caseObj){
        return caseObj.status.includes('new')
      })
      var communityNew = communityFilter.filter(function(caseObj){
        return caseObj.status.includes('new')
      })
      var channelNew = channelFilter.filter(function(caseObj){
        return caseObj.status.includes('new')
      })
      var commenterNew = commenterFilter.filter(function(caseObj){
        return caseObj.status.includes('new')
      })

      // Open cases stats using complicated maths
      var priorityOpen = priorityFilter.length - priorityNew.length
      var saasOpen = saasFilter.length - saasNew.length
      var directOpen = directFilter.length - directNew.length
      var communityOpen = communityFilter.length - communityNew.length
      var channelOpen = channelFilter.length - channelNew.length
      var commenterOpen = commenterFilter.length - commenterNew.length

      // Object so we can easily build the slack message
      // Format: {"Filter Name": All cases, New cases, Open cases, "Needs attention" threshold for each filter}
      stats = {
        Priority:[priorityFilter.length,priorityNew.length,priorityOpen,10],
        "Saas & Ads":[saasFilter.length,saasNew.length,saasOpen,30],
        Direct:[directFilter.length,directNew.length,directOpen,30],
        Community:[communityFilter.length,communityNew.length,communityOpen,30],
        Channel:[channelFilter.length,channelNew.length,channelOpen,30],
        Commenter:[commenterFilter.length,commenterNew.length,commenterOpen,60],
      }
    }
  // Build and send the message with data from each filter
  function slackSend() {
    var total = 0
    var attachments = []
    var statusColor
    Object.keys(stats).map(function(objectKey, i) {
      total += stats[objectKey][0]
      if (stats[objectKey][0] > stats[objectKey][3]) {
        statusColor = disqusRed
        statusIcon = "🔥"
      } else if (stats[objectKey][0] <= 5) {
        statusColor = disqusGreen
        statusIcon = ":partyporkchop:"
      } else {
        statusColor = disqusGreen
        statusIcon = "🆒"
      }
      attachments.push({
        "fallback": stats[objectKey][0] + " total" + stats[objectKey][1] + " new" + stats[objectKey][2] + " open",
        "color": statusColor,       
        "title": statusIcon + " " + objectKey + ": " + stats[objectKey][0],
        "text": stats[objectKey][1] + " new, " + stats[objectKey][2] + " open"
      })
    });
    
    let statusMessage = {
          "response_type": "in_channel",
          "text": total + " total cases right now.",
          "attachments": attachments
        }
    // depending on request origin, also send the response as webhook for daily notifications
    if (type === 'notification') {
      webhook({text:"Morning report incoming!"});
      webhook(statusMessage);
    }
    res.send(statusMessage);
  }
}

function webhook(message) {
  request.post(
    'https://hooks.slack.com/services/T024PTBSY/B7H11E2Q4/'+process.env.SLACK_WEBHOOK,
    { json: message },
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
        }
    }
  );
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});