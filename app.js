const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const request = require('request')
const Intercom = require('intercom-client');

const client = new Intercom.Client({ token: process.env.INTERCOM_TOKEN });

// Use glitchup package to prevent server from sleeping
const glitchup = require('glitchup');
glitchup();

// Express middleware for parsing request/resonse bodies
app.use(bodyParser.urlencoded({extended: false}));

// Important functions to re-write
// status() - default
// caseAttachment() - case link with ID
// emailSearch() - email address
// caseCard() - singe case message to send

// init sqlite db
var fs = require('fs');
var dbFile = './.data/sqlite.db';
var exists = fs.existsSync(dbFile);
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database(dbFile);

// if ./.data/sqlite.db does not exist, create it, otherwise print records to console
db.serialize(function(){
  if (!exists) {
    db.run('CREATE TABLE Conversations (UPDATED DATE, FULLLIST BLOB)');
    // db.run('DROP TABLE Conversations');
    console.log('New table Conversations created!');
    
    // insert default conversations
    db.serialize(function() {
      db.run(`INSERT INTO Conversations VALUES (CURRENT_TIMESTAMP, "[test2]")`);
    });
  }
  else {
    console.log('Database "Conversations" ready to go!');
    db.each('SELECT * from Conversations', function(err, row) {
      if ( row ) {
        console.log('record:', row);
      }
    });
  }
});

// Run the list API call to Intercom every 10 min. so it can be cached
function intervalFunc() {
  list();
}

// setInterval(intervalFunc, 1000 * 60 * 10 );

// endpoint to get all the dreams in the database
// https://www.npmjs.com/package/sqlite3
let getLastStat = new Promise( function(resolve, reject) {
  db.all('SELECT * from Conversations Limit 1', function(err, rows) {
    if (err) {
      reject(err)
    }
    resolve(rows[0].UPDATED);
  });
});

let conversationData = {
  fullList: [],
  timeUpdated: null,
}

// Store parts of the conversationData object for cache that slack command can use 
function storeStats(fullList) {
  // insert one row into the Conversations table
  db.run(`INSERT INTO Conversations VALUES (CURRENT_TIMESTAMP, ${fullList})`), function(err) {
    if (err) {
      return console.log(err.message);
    }
    // get the last insert id
    console.log(`A row has been inserted with rowid ${this.lastID}`);
  }
 
  // close the database connection
  db.close();
}

// TODO Count up all the conversations by team assignee
function count() {
  return {priority: 5}
}

// Paginate through all next page objects recursively
function getMorePages(page, acc) {
  client.nextPage(page).then(
    function (nextPage) {
      acc += nextPage.body.conversations
      console.log("3",acc)
      if (nextPage.body.pages.next) {
        console.log("4"," there's more, get more!")
        getMorePages(nextPage.body.pages, acc)
      }
      else {
        storeStats(acc)
        return acc
      }
  }).catch(
      // Log the rejection reason
      (reason) => {
        console.log('Handle rejected promise ('+reason+')');
      })
}

// Get the first page of results and paginate if more results exist
function list() {
  client.conversations.list( { open: true, per_page: 60 }).then(
    function (firstPage, acc = []) {
      console.log("1",acc)
      acc += firstPage.body.conversations
      console.log("2",acc)
      getMorePages(firstPage.body.pages, acc)
    }).catch(
      // Log the rejection reason
      (reason) => {
        console.log('Handle rejected promise ('+reason+')');
      })
}

app.post('/', function (req, res) {
  // Check the slack token so that this request is authenticated
  if (req.body.token === process.env.SLACK_TOKEN) {
    // Detect which command was entered in slack and call the correct function
    if (req.body.text.length === 0) {
      //
    // validates a full Desk link
    } else if (/^[0-9]{1,7}$/.test(req.body.text.split('conversations/')[1])) {
      caseAttachment(req.body.text.split('conversations/')[1])
    // validates email
    } else if (/([\w\.]+)@([\w\.]+)\.(\w+)/.test(req.body.text)) {
      emailSearch(req.body.text)
    } else if (req.body.text === "help") {
      help()
    } else if (req.body.text === "test") {
      // getLastStat() should just return a timestamp from the sqlite database table
      getLastStat.then(function(lastStat) {
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
  function caseCard(text, status, id, subject, blurb, labels, ts, customer, company, customerGrav, assigned) {
    if (company) {
      company = "("+company+")"
    }
    if (!assigned) {
      assigned = "Nobody"
    }
    let attachement = {
      "pretext": status + " case from " + customer + " " + company,
      "fallback": status + " case from " + customer + " " + company + "- #" + id + ": "+ subject,
      "author_icon": customerGrav,
      "author_name":  customer + " " + company,
      "title": "#" + id + ": "+ subject,
      "title_link": "https://help.disqus.com/agent/case/"+id,
      "text": blurb,
      "fields": [
        {
          "title": "Assigned",
          "value": assigned,
          "short": true
        },
        {
          "title": "Labels",
          "value": labels,
          "short": true
        }
      ],
      "color": "#7CD197",
      "ts": ts
    }
    return attachement
  }
  
  // does something
  function uniqueMap(a, key) {
    let keysArray = [];
    let uniqueArray = [];
    a.forEach( obj => keysArray.push(obj[key]));
    a.forEach( obj => keysArray.indexOf(obj[key]) === keysArray.lastIndexOf(obj[key]) ? uniqueArray.push(obj) : console.log())
    return uniqueArray;
  }
  
  // Return help text with examples
  function help() {
    res.send(
      {
        "response_type": "ephemeral",
        "text": "Type `/support` for status accross all filters. Add a case link `https://app.intercom.io/a/apps/x2byp8hg/inbox/inbox/1935680/conversations/18437669699` or an email `hello@gmail.com` to get specific.",
      }
    )
  }
})

function webhook(message) {
  request.post(
    'https://hooks.slack.com/services/T024PTBSY/B7H11E2Q4/'+process.env.SLACK_WEBHOOK,
    { json: message },
    function (error, response, body) {
        if (!error && response.statusCode == 200) {
        }
    }
  );
}

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});