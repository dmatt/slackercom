const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const desk = require('./my-desk').createClient({
  subdomain: 'help',
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  token: process.env.TOKEN,
  token_secret: process.env.TOKEN_SECRET
});

// Elements for output message
const disqusRed = '#e76c35'
const disqusGreen = '#7fbd5a'
let statusIcon
let stats = ""

// Express middleware for parsing request/resonse bodies
app.use(bodyParser.urlencoded({extended: false}));

app.post('/', function (req, res) {
  
  // Check the slack token so that this request is authenticated
  if (req.body.token === process.env.SLACK_TOKEN) {
    // Decide what command was entered in slack and call the correct function
    if (req.body.text.length === 0) {
      status()
      // TODO: regex should validate the full Desk link, not ID
    } else if (/^[0-9]{1,7}$/.test(req.body.text.split('case/')[1])) {
      caseIdSearch(req.body.text.split('case/')[1])
    } else if (req.body.text === "archon810@gmail.com") {
      emailSearch(req.body.text)
    } else if (req.body.text === "help") {
      help()
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
  // Handle each command, and return relevant information to slack
  // Return stats on all case filters from Desk
  function status() {    
      console.time("status")
      var dataEntries = []
      // Recursively call Desk until there are no more pages of results
      let i = 1
      function deskCall() {
        desk.cases({
          labels:['Priority publisher,SaaS Ads,Direct publisher,Community publisher,Home,Community commenter'], 
          status:['new,open'], 
          sort_field:'created_at', 
          sort_direction: 'asc', 
          per_page:100, 
          page:i
        }, function(error, data) {
          console.log(i,Math.ceil(data.total_entries/100))
          if (i <= Math.ceil(data.total_entries/100)) {
            dataEntries = dataEntries.concat(data._embedded.entries)           
            i++
            deskCall()
          } else if (!data) {
            error()
            console.log(error)
          } else {
            filterSend(dataEntries)
          }
        });
      }
      deskCall()
      
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
          return caseObj.labels.includes('SaaS Ads')
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
          return caseObj.labels.includes('Community commenter') && caseObj.status.includes('new')
        })
        
        // New cases stats only for further segments
        var priorityNew = priorityFilter.filter(function(caseObj){
          return caseObj.status.includes('new')
        })
        var saasNew = saasFilter.filter(function(caseObj){
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
      var attachments = []
      var statusColor
      Object.keys(stats).map(function(objectKey, i) {
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
      res.send(
          {
            "response_type": "in_channel",
            "text": "Here's our status:",
            "attachments": attachments
          }
      );
      console.timeEnd("status")
    }
  }
  // Return case that matches case id
  function caseIdSearch(text) {
    desk.get("cases", {case_id: text}, function(error, data) {
      if (data._embedded.entries.length > 0) {
        res.send(
          {
            "response_type": "in_channel",
            "text": JSON.stringify(data._embedded.entries[0].blurb),
          }
        );
        console.dir(data)
      } else if (data._embedded.entries.length < 1) {
        empty()
      } else {
        help()
      }
    });
  }
  // Return case that matches email
  function emailSearch(text) {
    desk.get("cases", {case_id: text}, function(error, data) {
      if (data._embedded.entries.length > 0) {
        res.send(
          {
            "response_type": "in_channel",
            "text": JSON.stringify(data._embedded.entries[0].blurb),
          }
        );
        console.dir(data)
      } else if (data._embedded.entries.length < 1) {
        empty()
      } else {
        help()
      }
    });
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

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
