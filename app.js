var express = require('express')
var app = express()
var desk = require('desk').createClient({
  subdomain: 'disqus',
  consumer_key: 'key',
  consumer_secret: 'secret',
  token: 'token',
  secret: 'token_secret'
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
  console.log(req);
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})