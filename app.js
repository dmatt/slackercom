var express = require('express')
var app = express()
var desk = require('desk-api').createClient({
  subdomain: 'help', //TODO: FIX THE desk-api
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  token: process.env.TOKEN,
  token_secret: process.env.TOKEN_SECRET
});

app.get('/', function (req, res) {
  res.send('YOU ARE A BUTT!')
  // if query.token = '2365Mb38QS6zo2E8azlirAwT'
  // if no additional text
  // func() CASE STATUS (all filters and #s)  
  // if regex = case ID
  // func() case body and link
  // if regex = email address
  // func() recent cases matching email
  desk.cases({status: 'new,open'}, function(error, data) {
    console.log(error);
    console.log(data);
  });
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})