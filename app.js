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
let statusIcon = ''
let stats = ""

// Express middleware for parsing request/resonse bodies
app.use(bodyParser.urlencoded({extended: false}));

// Returns # of cases resolved > 1 message within past 24 hours
// How to build message response back to slack http://phabricator.local.disqus.net/diffusion/HUBOT/browse/master/scripts/embedcomment.coffee

app.post('/', function (req, res) {
  // Check the slack token so that this request is authenticated
  if (req.body.token === process.env.SLACK_TOKEN && req.body.token === 'status') {
      // Make Desk API calls by paginating through all results
      console.time('desk.cases()');
      var dataEntries = []
      var i = 1
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
      console.timeEnd('desk.cases()');
      
      function filterSend(dataEntries) {
        createStats(dataEntries)
        slackSend()
      }
    
      // Filter the data into seprate objects that correspond to each Desk filter
      function createStats(dataEntries) {
        console.time('filters');
        console.log('passed in!',dataEntries.length)
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
        
        stats = {
          Priority:[priorityFilter,priorityNew,priorityOpen],
          Saas:[saasFilter,saasNew,saasOpen],
          Direct:[directFilter,directNew,directOpen],
          Community:[communityFilter,communityNew,communityOpen],
          Channel:[channelFilter,channelNew,channelOpen],
          Commenter:[commenterFilter,commenterNew,commenterOpen],
        }
        
        console.timeEnd('filters');
        // log things to the console for fun times
        console.log(
                  "data total entries "+dataEntries.length+"\n",
                  "priorityFilter "+priorityFilter.length+"\n",
                  "saasFilter "+saasFilter.length+"\n",
                  "directFilter "+directFilter.length+"\n",
                  "communityFilter "+communityFilter.length+"\n",
                  "channelFilter "+channelFilter.length+"\n",
                  "commenterFilter "+commenterFilter.length
                )
      }
    
    // Build and send the message with data from each filter
    function slackSend() {
      res.send(
          {
            "response_type": "in_channel",
            "text": ":partywizard:\n"+stats,
            /*"attachments": [
              {
                  "fallback": "Required plain-text summary of the attachment.",
                  "color": disqusGreen,
                  "title": statusIcon+"Priority",
                  "text": priorityNew.length+" New,"+priorityOpen+" Open"
              },{
                  "fallback": "Required plain-text summary of the attachment.",
                  "color": disqusGreen,
                  "title": statusIcon+"SaaS & Ads",
                  "text": priorityNew.length+" New,"+priorityFilter.length-priorityNew.length+" Open"
              },{
                  "fallback": "Required plain-text summary of the attachment.",
                  "color": disqusGreen,
                  "title": statusIcon+"Direct",
                  "text": priorityNew.length+" New,"+priorityFilter.length-priorityNew.length+" Open"
              },{
                  "fallback": "Required plain-text summary of the attachment.",
                  "color": disqusGreen,
                  "title": statusIcon+"Community",
                  "text": priorityNew.length+" New,"+priorityFilter.length-priorityNew.length+" Open"
              },{
                  "fallback": "Required plain-text summary of the attachment.",
                  "color": disqusGreen,
                  "title": statusIcon+"Channel",
                  "text": priorityNew.length+" New,"+priorityFilter.length-priorityNew.length+" Open"
              },{
                  "fallback": "Required plain-text summary of the attachment.",
                  "color": disqusGreen,
                  "title": "Commenter",
                  "text": priorityNew.length+" New,"+priorityFilter.length-priorityNew.length+" Open"
              }
            ]*/
          }
      );
    }
  } else {
    console.log(req);
    res.send('unauthorized wow');
  }
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
