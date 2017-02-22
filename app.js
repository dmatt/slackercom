var express = require('express')
var app = express()
var desk = require('desk').createClient({
  subdomain: 'help.disqus',
  consumer_key: 'b2OgaOeoQBELQNUe81NC',
  consumer_secret: '2rMQACnuWx1hDhxw6JdcENwaiaRI0BkbKlAOEpWU',
  token: 'tkMD7r6eykjv6tY0M3pfoOfKJUZmuwlXbaXC2jPf',
  secret: 'ThaVoopcwCbGiS5YqxhG'
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