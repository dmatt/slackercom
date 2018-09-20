// 👀 Current status: ne-db is working, need to design the records, mapStats gets total count

const express = require('express');
const bodyParser = require('body-parser');
const Intercom = require('intercom-client');
const glitchup = require('glitchup');
const Datastore = require('nedb'); // setup a new database

const app = express();
const client = new Intercom.Client({ token: process.env.INTERCOM_TOKEN });
const db = new Datastore({ filename: '.data/datafile', autoload: true });

// Express middleware for parsing request/resonse bodies
app.use(bodyParser.urlencoded({ extended: false }));

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

// default conversations status data
const defaultStatusRecords = [
  new StatusRecord('today', { convo: '1' }, 1),
  new StatusRecord('yesterday', { convo: '2' }, 2),
];

db.count({}, (countErr, count) => {
  console.log(`There are ${count} conversation rows in the database`);
  if (countErr) console.log('There\'s a problem with the database: ', countErr);
  else if (count <= 0) { // empty database so needs populating
    // default users inserted in the database
    db.insert(defaultStatusRecords, (insertErr, recordsAdded) => {
      if (insertErr) console.log('There\'s a problem with the database: ', insertErr);
      else if (recordsAdded) console.log('Default recordsAdded inserted in the database');
    });
  }
});

// Array of team name strings to monitor, default is all teams
let monitoredTeams = []

// Callback to list() on interval get Intercom data
// setInterval(list, 1000 * 60 * 10 );
// setInterval(list, 3000 );

// Call intercom for first page converations and paginate if more results exist
//function test() {}

// Maps converstation data to simple stats for each team
function mapConvoStats(data) {
  const assignees = data.map(obj => obj.assignee);
  console.log('🤔', assignees.length);
  storeStats(assignees, assignees.length);
}

// Paginate through Intercom nextPage objects recursively
function getMorePages(page, conversationData) {
  client.nextPage(page).then(
    (nextPage) => {
      const conversationDataMultiple = conversationData.concat(nextPage.body.conversations);
      if (nextPage.body.pages.next) {
        getMorePages(nextPage.body.pages, conversationDataMultiple);
      } else {
        mapConvoStats(conversationDataMultiple);
      }
      return conversationDataMultiple;
  },
  ).catch(
      // Log the rejection reason
      (reason) => {
        console.log(`Handle rejected promise in getMorePages() (${reason})`);
      },
      );
}

// Call intercom for first page converations and paginate if more results exist
function listConversations() {
  client.conversations.listConversations({ open: true, per_page: 20 }).then(
    (firstPage, conversationData = []) => {
      const conversationDataSingle = conversationData.concat(firstPage.body.conversations);
      if (firstPage.body.pages.next) {
        getMorePages(firstPage.body.pages, conversationDataSingle);
      } else {
        mapConvoStats(conversationDataSingle);
      }
      return conversationDataSingle;
    },
    ).catch(
      // Log the rejection reason
      (reason) => {
        console.log(`Handle rejected promise in list() (${reason})`);
      },
      );
}

//listConversations();

// When given case ID, get and send all case, customer, and assigned user details to slack
function caseAttachment(id) {
  // https://app.intercom.io/a/apps/x2byp8hg/inbox/inbox/1935680/conversations/18437669699
  // desk.case(id, {}, function(error, data) {
  // });
}

// Returns most recent case ids that matches email
function emailSearch(email) {
  // desk.get('cases/search/',
  // {email: email, sort_field:'created_at', sort_direction: 'desc'}, function(error, data) {
  // });
}

// Returns a single case attachment using data from
function caseCard(text, subject, company, etc) {
  // return `attachement` obect for slack message from data
}

// Return help text to client with examples of proper usage
function help(res) {
  const helpText = 'Type `/support` for status accross all filters. Add a case link `https://app.intercom.io/a/apps/x2byp8hg/inbox/inbox/1935680/conversations/18437669699` or an email `hello@gmail.com` to get specific.'
  res.send(
    {
      response_type: 'ephemeral',
      text: helpText,
    },
  );
}

// Handler of post requests to server, checks request text to trigger different functions
app.post('/', (req, res) => {
  // Check the slack token so that this request is authenticated
  if (req.body.token === process.env.SLACK_TOKEN) {
    // Detect which command was entered in slack and call the correct function
    if (req.body.text.length === 0) {
      // getLastStat() should just return a timestamp from the sqlite database table
      getLastStat.then((lastStat) => {
        console.log();
        res.send(
          {
            response_type: 'ephemeral',
            text: `hello ${lastStat}`,
          },
        );
      });
    // validates a full Intercom link exists in command text
    } else if (/^[0-9]{1,7}$/.test(req.body.text.split('conversations/')[1])) {
      caseAttachment(req.body.text.split('conversations/')[1]);
      // validates email
    } else if (/([\w\.]+)@([\w\.]+)\.(\w+)/.test(req.body.text)) {
      emailSearch(req.body.text);
    } else if (req.body.text === 'help') {
      help(res);
    } else {
      res.send('Sorry bub, I\'m not quite following. Type `/support help` to see what I can understand.');
    }
  } else {
    res.send(
      {
        response_type: 'ephemeral',
        text: 'Wow, such unauthorized',
      },
    );
  }
});

// listen for requests :)
const listener = app.listen(53923, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});
