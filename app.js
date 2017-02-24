var express = require('express')
var app = express()
// local desk api wrapper because node module doesn't handle custom domains
var desk = require('./my-desk').createClient({
  subdomain: 'help',
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  token: process.env.TOKEN,
  token_secret: process.env.TOKEN_SECRET
});

app.get('/', function (req, res) {
  if (req.query.token == process.env.SLACK_TOKEN) {
    res.send('hi slack');
  }
  else {
    res.send('dashboard wow');
  }
})

function buildMessage (text, attachementText) {
  return {
      "response_type": "in_channel",
      "text": text,
      "attachments": [
          {
              "text": attachementText
          }
      ]
  }
}

// Desk API returns # of new and open cases in each Desk filter: Priority, Saas, Direct, 
// Returns # of cases resolved > 1 message within past 24 hours

function caseStatus () {
  desk.cases({status: 'new,open', priority:'9'}, function(error, data) {  
          });
}


// if no additional text
// func() CASE STATUS (all filters and #s)  
// if regex = case ID
// func() case body and link
// if regex = email address
// func() recent cases matching email   

//function caseIdSearch () {}
//function emailSearch () {}

// How to build message response back to slack http://phabricator.local.disqus.net/diffusion/HUBOT/browse/master/scripts/embedcomment.coffee

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})