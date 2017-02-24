var express = require('express')
var app = express()
var desk = require('./my-desk').createClient({
  subdomain: 'help', //TODO: FIX THE desk-api oauth call bc our domain is not *.desk.com
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  token: process.env.TOKEN,
  token_secret: process.env.TOKEN_SECRET
});

app.post('/', function (req, res) {
  if (req.query.token == '2365Mb38QS6zo2E8azlirAwT') {
    desk.cases({status: 'new,open', priority:'9'}, function(error, data) {
          console.log(req.query.token);
          res.send('hi slack'+data);      
        });
  }
  else {
    res.send('hi non-disqus POST');    
    // if no additional text
    // func() CASE STATUS (all filters and #s)  
    // if regex = case ID
    // func() case body and link
    // if regex = email address
    // func() recent cases matching email
  }
})

app.get('/', function (req, res) {
      res.send('hi web user');
})

// How to build message response back to slack http://phabricator.local.disqus.net/diffusion/HUBOT/browse/master/scripts/embedcomment.coffee

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})