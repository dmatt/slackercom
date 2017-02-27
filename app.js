const express = require('express')
const app = express()
const bodyParser = require('body-parser')
// local desk api wrapper because node module doesn't handle custom domains
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
  if (req.body.token === process.env.SLACK_TOKEN) {
      console.log('try a desk cases call')
      desk.cases({labels:['Priority publisher','SaaS Ads','Direct publisher','Community publisher','Home','Community commenter'], status:['new','open']}, function(error, data) { 
        res.send('hi slack wow');
        console.log(data)
      });
  } else {
    console.log(req);
    res.send('unauthorized wow');
  }
})

app.get('/', function (req, res) {
  res.send('dashboard wow');
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
            "title": " ✅ Commenters",
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