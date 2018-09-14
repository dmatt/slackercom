// 👀 Current status: working on mapStats function, trying look at format, figure out best manipulation

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

// init sqlite db
var fs = require('fs');
var dbFile = './.data/sqlite.db';
var exists = fs.existsSync(dbFile);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(dbFile);

// Array of team name strings to monitor, default is all teams
let monitoredTeams = []

// Callback to list() on interval get Intercom data
// setInterval(list, 1000 * 60 * 10 );
//setInterval(list, 3000 );

// Create DB and popular with default data.
db.serialize( function() {
  if (!exists) {
    db.run('DROP TABLE Conversations');
    db.run('CREATE TABLE Conversations (UPDATED DATE, FULLLIST BLOB)');
    console.log('New table Conversations created!');
    
    // insert default conversations
    db.serialize(function() {
      db.run(`INSERT INTO Conversations VALUES (CURRENT_TIMESTAMP, "[{'test2foo': 'foo', 'test2bar': 'bar'},{'test3foo': 'foo', 'test3bar': 'bar'}]")`);
    });
  }
  // Log out all rows for console
  else {
    console.log('Database "Conversations" ready to go!');
    db.each('SELECT * from Conversations', function(err, row) {
      if ( row ) {
        console.log('record:', row);
      }
      else if ( err ) {
        console.log('error:', err);
      }
    });
  }
});

// Get all conversations from DB https://www.npmjs.com/package/sqlite3
let getLastStat = new Promise( function(resolve, reject) {
  db.all('SELECT * from Conversations Limit 1', function(err, rows) {
    if (err) {
      reject(err)
    }
    resolve(rows[0]);
  });
});

// Store fullList object in DB so slack command can use intermittently
function storeStats(fullList) {
  // insert one row into the Conversations table
  db.run(`INSERT INTO Conversations VALUES (CURRENT_TIMESTAMP, ${fullList})`), function(err) {
    // Log error
    if (err) {
      return console.log(err.message);
    }
    // Log the last inserted id if no errors
    console.log(`A row has been inserted with rowid ${this.lastID}`);
  }
  // close the database connection
  db.close();
}

// Call intercom for first page converations and paginate if more results exist
function list() {
  client.conversations.list( { open: true, per_page: 20 }).then(
    function (firstPage, acc = []) {
      acc.push(firstPage.body.conversations)
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
      acc.push(nextPage.body.conversations)
      if (nextPage.body.pages.next) {
        getMorePages(nextPage.body.pages, acc)
      } else {
        console.log("acc type: ", typeof acc)
        mapConvoStats(acc)
        return acc
      }
  }).catch(
      // Log the rejection reason
      (reason) => {
        console.log('Handle rejected promise in getMorePages() ('+reason+')');
      })
}

//setInterval(list, 3000 );
//list()

// Maps converstation data to simple stats for each team
function mapConvoStats(data) {
  const assignees = data.map(function(obj, i) {
    console.log(i, " mapped");
    return obj;
  });
  console.log("🤔", assignees);
  // callback to storeStats()
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
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});