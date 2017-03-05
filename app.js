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

// Disqus colors for output message
const disqusRed = '#e76c35'
const disqusGreen = '#7fbd5a'

// Express middleware for parsing request/resonse bodies
app.use(bodyParser.urlencoded({extended: false}));

// Returns # of cases resolved > 1 message within past 24 hours
// How to build message response back to slack http://phabricator.local.disqus.net/diffusion/HUBOT/browse/master/scripts/embedcomment.coffee

app.post('/', function (req, res) {
  // Check the slack token so that this request is authenticated
  if (req.body.token === process.env.SLACK_TOKEN) {
      // Make Desk API calls by paginating through all results
      console.time('desk.cases()');
      var dataEntries = []
      var i
      for (i = 1; i < 3; i++) {
          desk.cases({labels:['Priority publisher,SaaS Ads,Direct publisher,Community publisher,Home,Community commenter'], status:['new,open'], sort_field:'created_at', sort_direction: 'asc', per_page:100, page:1}, function(error, data) {
          console.log('next object: ',data._links.next)
          dataEntries = dataEntries.concat(data._embedded.entries)
          console.log(data._embedded.entries.length)            
          console.log('BEFORE passing in!',dataEntries.length)
          if (data && i = 2) {
            callback()
          }
        });
        }
      console.timeEnd('desk.cases()');
      
      function callback() { 
        createFilters(dataEntries)
        slackSend()
      }
    
      // Filter the data into seprate objects that correspond to each Desk filter
      function createFilters(dataEntries) {
        console.time('filters');
        console.log('passed in!',dataEntries.length)
        var priorityFilter = dataEntries.filter(function(caseObj){
          return caseObj.labels.includes('Priority publisher') && !caseObj.labels.includes('SaaS Ads')
        })
        var saasFilter = dataEntries.filter(function(caseObj){
          return caseObj.labels.includes('SaaS Ads')
        })
        var directFilter = dataEntries.filter(function(caseObj){
          return caseObj.labels.includes('Direct publisher')
        })
        var communityFilter = dataEntries.filter(function(caseObj){
          return caseObj.labels.includes('Community publisher')
        })
        var channelFilter = dataEntries.filter(function(caseObj){
          return caseObj.labels.includes('Home')
        })
        var commenterFilter = dataEntries.filter(function(caseObj){
          return caseObj.labels.includes('Community commenter')
        })
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
         //console.dir(priorityFilter)        
      }
    
    // Build and send the message with data from each filter
    function slackSend() {
      res.send(
          {
            "text": "Looking good!\n _BUTT cases recently resolved_",
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

/*

//complex//

{
    "text": "Looking good!\n _12 recently resolved_",
    "attachments": [
        {
            "fallback": "Required plain-text summary of the attachment.",
            "color": "#36a64f",
            "title": " ✅ Priority",
            "text": "23 New, 15 Open\n"
        },{
            "fallback": "Required plain-text summary of the attachment.",
            "color": "#ff0000",
            "title": "⚠️ SaaS",
            "text": "23 New, 15 Open"
        },{
            "fallback": "Required plain-text summary of the attachment.",
            "color": "#36a64f",
            "title": " ✅ Direct",
            "text": "0 New, 23 Open"
        },{
            "fallback": "Required plain-text summary of the attachment.",
            "color": "#36a64f",
            "title": " ✅ Community",
            "text": "0 New, 23 Open"
        },{
            "fallback": "Required plain-text summary of the attachment.",
            "color": "#36a64f",
            "title": " ✅ Channel",
            "text": "0 New, 23 Open"
        },{
            "fallback": "Required plain-text summary of the attachment.",
            "color": "#36a64f",
            "title": " ✅ Commenter",
            "text": "0 New, 23 Open"
        }
    ]
}

//simple//

{
    "text": "✅ *Priority* 12 New, 10 open\n 🔥 *Direct* 33 New, 89 open"
}

*/

/* Currently unused

function message(text, attachements) {
    this.response_type = 'in_channel';
    this.text = text;
    this.attachements = attachements;
}

*/