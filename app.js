const express = require('express')
const app = express()
const bodyParser = require('body-parser')
// local desk api wrapper extended from https://www.npmjs.com/package/desk-api because it doesn't handle custom domains
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

// Returns # of cases resolved > 1 message within past 24 hours
// How to build message response back to slack http://phabricator.local.disqus.net/diffusion/HUBOT/browse/master/scripts/embedcomment.coffee

app.post('/', function (req, res) {
  // Check the slack token so that this request is authenticated
  if (req.body.token === process.env.SLACK_TOKEN && req.body.text.length === 0) {
      console.time("status")    
      // Make Desk API calls by paginating through all results
      var dataEntries = []
      var i = 1
      // Recursively call Desk until there are no more pages of results
      function deskCall() {
        desk.cases({labels:['Priority publisher,SaaS Ads,Direct publisher,Community publisher,Home,Community commenter'], status:['new,open'], sort_field:'created_at', sort_direction: 'asc', per_page:100, page:i}, function(error, data) {
          if (i <= Math.ceil(data.total_entries/100)) {
            dataEntries = dataEntries.concat(data._embedded.entries)           
            i++
            deskCall()
          } else if (!data) {
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
        
        // New cases stats
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
        
        // Open cases stats
        var priorityOpen = priorityFilter.length - priorityNew.length
        var saasOpen = saasFilter.length - saasNew.length
        var directOpen = directFilter.length - directNew.length
        var communityOpen = communityFilter.length - communityNew.length
        var channelOpen = channelFilter.length - channelNew.length
        var commenterOpen = commenterFilter.length - commenterNew.length
        
        // Object so we can easily build the slack message
        // Format: {Filter Name: Total, New, Open, "On-fire" threshold}
        stats = {
          Priority:[priorityFilter.length,priorityNew.length,priorityOpen,10],
          "Saas & Ads":[saasFilter.length,saasNew.length,saasOpen,40],
          Direct:[directFilter.length,directNew.length,directOpen,40],
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
  } else if (req.body.token === process.env.SLACK_TOKEN && req.body.text === "347519") {
    res.send(
      {
        "response_type": "in_channel",
        "text": "Case ID ya",
      }
    );
  } else if (req.body.token === process.env.SLACK_TOKEN && req.body.text === "archon810@gmail.com") {
    res.send(
      {
        "response_type": "in_channel",
        "text": "email ya",
      }
    );
  } else if (req.body.token === process.env.SLACK_TOKEN && req.body.text === "help") {
    res.send(
      {
        "response_type": "in_channel",
        "text": "Type `/support` for status accross all filters. Add a case ID `347519` or an email `archon810@gmail.com` to get specific.",
      }
    )
  } else {
    console.log(req);
    res.send('unauthorized wow');
  }
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
