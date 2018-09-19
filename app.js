// 👀 Current status: ne-db is working, need to design the records, mapStats gets total count

const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const Intercom = require('intercom-client');
const client = new Intercom.Client({ token: process.env.INTERCOM_TOKEN });
const glitchup = require('glitchup');

// Express middleware for parsing request/resonse bodies
app.use(bodyParser.urlencoded({extended: false}));

// Important functions to re-write
// status() - default
// caseAttachment() - case link with ID
// emailSearch() - email address
// caseCard() - singe case message to send

// prevent server from sleeping
glitchup();

function StatusRecord(timestamp, data, total) {
  this.timestamp = timestamp;
  this.data = data;
  this.total = total;
}

let statusRecord1 = new StatusRecord("today", {"convo": "1"}, 1);
let statusRecord2 = new StatusRecord("yesterday", {"convo": "2"}, 2);

// default conversations status data
var conversations = [
  statusRecord1,
  statusRecord2
];

// setup a new database
var Datastore = require('nedb'),
    // Security note: the database is saved to the file `datafile` on the local filesystem. It's deliberately placed in the `.data` directory
    // which doesn't get copied if someone remixes the project.
    db = new Datastore({ filename: '.data/datafile', autoload: true });

db.count({}, function (err, count) {
  console.log("There are " + count + " conversation rows in the database");
  if(err) console.log("There's a problem with the database: ", err);
  else if(count<=0){ // empty database so needs populating
    // default users inserted in the database
    db.insert(conversations, function (err, conversationsAdded) {
      if(err) console.log("There's a problem with the database: ", err);
      else if(conversationsAdded) console.log("Default conversationsAdded inserted in the database");
    });
  }
});

// Array of team name strings to monitor, default is all teams
let monitoredTeams = []

// Callback to list() on interval get Intercom data
// setInterval(list, 1000 * 60 * 10 );
// setInterval(list, 3000 );

// Call intercom for first page converations and paginate if more results exist
function list() {
  client.conversations.list( { open: true, per_page: 20 }).then(
    function (firstPage, acc = []) {
      acc = acc.concat(firstPage.body.conversations)
      if (firstPage.body.pages.next) {
        getMorePages(firstPage.body.pages, acc)
      }
      else {
        mapConvoStats(acc)
        return acc
      }
    }).catch(
      // Log the rejection reason
      (reason) => {
        console.log('Handle rejected promise in list() ('+reason+')');
      })
}

// Paginate through Intercom nextPage objects recursively
function getMorePages(page, acc) {
  client.nextPage(page).then(
    function (nextPage) {
      acc = acc.concat(nextPage.body.conversations)
      if (nextPage.body.pages.next) {
        getMorePages(nextPage.body.pages, acc)
      } else {
        mapConvoStats(acc)
        return acc
      }
  }).catch(
      // Log the rejection reason
      (reason) => {
        console.log('Handle rejected promise in getMorePages() ('+reason+')');
      })
}

// list()

// Maps converstation data to simple stats for each team
function mapConvoStats(data) {
  const assignees = data.map(function(obj, i) {
    return obj.assignee;
  });
  console.log("🤔", assignees.length);
  storeStats(assignees, assignees.length)
}

// Handler of post requests to server, checks request text to trigger different functions
app.post('/', function (req, res) {
  // Check the slack token so that this request is authenticated
  if (req.body.token === process.env.SLACK_TOKEN) {
    // Detect which command was entered in slack and call the correct function
    if (req.body.text.length === 0) {
    
    }
    // validates a full Intercom link
    else if (/^[0-9]{1,7}$/.test(req.body.text.split('conversations/')[1])) {
      caseAttachment(req.body.text.split('conversations/')[1])
    } // validates email
    else if (/([\w\.]+)@([\w\.]+)\.(\w+)/.test(req.body.text)) {
      emailSearch(req.body.text)
    } else if (req.body.text === "help") {
      help()
    } else if (req.body.text === "test") {
      // getLastStat() should just return a timestamp from the sqlite database table
      getLastStat.then(function(lastStat) {
        console.log()
        res.send(
          {
            "response_type": "ephemeral",
            "text": `hello ${ lastStat }`,
          }
        )
      });
    } else {
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
  
  // When given case ID, get and send all case, customer, and assigned user details to slack
  function caseAttachment(id) {
    // https://app.intercom.io/a/apps/x2byp8hg/inbox/inbox/1935680/conversations/18437669699
    // desk.case(id, {}, function(error, data) {
    // });
  }
  
  // Returns most recent case ids that matches email
  function emailSearch(email) {
    // desk.get('cases/search/',{email: email, sort_field:'created_at', sort_direction: 'desc'}, function(error, data) {
    // });
  }
  
  // Returns a single case attachment using data from 
  function caseCard(text, subject, company, etc) {
    // return `attachement` obect for slack message from data
  }
  
  // Return help text with examples
  function help() {
    const helpText = "Type `/support` for status accross all filters. Add a case link `https://app.intercom.io/a/apps/x2byp8hg/inbox/inbox/1935680/conversations/18437669699` or an email `hello@gmail.com` to get specific."
    res.send(
      {
        "response_type": "ephemeral",
        "text": helpText,
      }
    )
  }
})

// listen for requests :)
var listener = app.listen(53923, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});