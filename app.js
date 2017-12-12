const express = require('express')
const app = express()
const bodyParser = require('body-parser')
var request = require('request');
const desk = require('./my-desk').createClient({
  subdomain: 'help',
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  token: process.env.TOKEN,
  token_secret: process.env.TOKEN_SECRET
});

var Twitter = require('twit'),
  config = { // Be sure to update the .env file with your API keys 
    twitter: {
      consumer_key: process.env.TWITTER_CONSUMER_KEY,
      consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
      access_token: process.env.TWITTER_ACCESS_TOKEN,
      access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
      //timeout_ms: 60*1000
    }
  },
  T = new Twitter(config.twitter),
  dmCounter = 0,
  twitterDMs={},
  twitterDMsSent={};

// Elements for output message
const disqusRed = '#e76c35'
const disqusGreen = '#7fbd5a'
let statusIcon
let stats = ""

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
    } else if (req.body.text === "dms") {
      getDMs()
    } else if (req.body.text === "csat") {
      csat()
    } else {
      console.log(req);
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
        var caseData = data
        desk.customer(caseData._links.customer.href.split("customers/")[1], {}, function(error, data) {
          if (data !== null) {
            var customerData = data
            if (data !== null) {
              var assignedName = 'Nobody'
              if (caseData._links.assigned_user) {
                desk.user(caseData._links.assigned_user.href.split("users/")[1], {}, function(error, data) {
                  if (data) {
                    var attachment = caseCard(
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
                var attachment = caseCard(
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
    var attachement = {
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
  
  // Find the last 10 recieved and sent DMs and count those without replies (there's no read/unread state via API 
  // https://twittercommunity.com/t/please-let-me-know-if-we-can-get-unread-messages-id-from-twitter-api-1-1/11745/2 )
  
  function getDMs() {
    dmCounter = 0
    return new Promise(function(resolve, reject) {
      T.get('direct_messages', { count: 30 }, function(err, dms, response) {
        twitterDMs = dms;
        T.get('direct_messages/sent', { count: 30 }, function(err, dmsSent, response) {
          twitterDMsSent = dmsSent;
          // We have DMs and Sent DMs so we can compare and count
          if (dms.length && dmsSent.length ) {
            // Search for each DM sender in sent object and increment counter if not found 
            dms.forEach( function (obj, i) {
               console.log("obj.sender.id ", obj.sender.id)
               console.log("length of match obj.sender.id -> dmSent.recipient.id", dmsSent.filter(dmSent => (dmSent.recipient.id === obj.sender.id)).length)
              if (dmsSent.filter(dmSent => (dmSent.recipient.id === obj.sender.id)).length < 1) {
                dmCounter++
              }
            });
            // We got the last DM, so we begin processing DMs from there
            res.send('Wow, you have '+dmCounter+' DMs on Twitter.');
            resolve(dms);
          } else {
            // We've never received any DMs at all, so we can't do anything yet
            console.log('This user has no DMs. Send one to it to kick things off!');
            resolve("This user has no DMs. Send one to it to kick things off.");
          }
        });        
      });
    });
  }
  
  // Return CSAT digest
  function csat() {
    res.send(
      {
        "response_type": "ephemeral",
        "text": "Type `/support` for status accross all filters. Add a case link `https://help.disqus.com/agent/case/347519` or an email `archon@gmail.com` to get specific.",
      }
    )
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
    var dataEntries = []
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
        // Twitter: [dmCounter, dmCounter, dmCounter, 3],
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
    // TODO Write function that stores this data to database
    //store(stats);
  }
}

app.get('/twitter', function (req, res) {
  res.send(twitterDMs)
})

app.get('/twitter_sent', function (req, res) {
  res.send(twitterDMsSent)
})

function webhook(message) {
  request.post(
    'https://hooks.slack.com/services/T024PTBSY/B5R2C2KDY/'+process.env.SLACK_WEBHOOK,
    { json: message },
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body)
        }
    }
  );
}

app.listen(process.env.PORT || 3000, function () {
  var port
  process.env.PORT ? port = process.env.PORT : port = 3000
  console.log('disqus-tickets app listening on port ' + port + '!')
})
