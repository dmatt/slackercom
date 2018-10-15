// 👀 Current status: now storing a pretty status row for team counts, work on other funtions now

const express = require('express');
const bodyParser = require('body-parser');
const Intercom = require('intercom-client');
const glitchup = require('glitchup');
const Datastore = require('nedb'); // setup a new database
const unescape = require('unescape');

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

class StatusRecord {
  constructor(type, timestamp, data, total) {
    this.type = type;
    this.timestamp = timestamp;
    this.data = data;
    this.total = total;
  }
}

// default conversations status data
const defaultStatusRecords = [
  new StatusRecord('status', 1439640522522, { convo: '1' }, 1),
  new StatusRecord('status', 1439640522521, { convo: '2' }, 2),
];

// Initialize database with Teams. TODO: check if teams have changed and update
db.count({ type: 'team' }, (countErr, count) => {
  console.log(`There are ${count} team rows in the database`);
  if (countErr) console.log('There\'s a problem with the database: ', countErr);
  else if (count <= 0) { // empty database so needs populating
    // default users inserted in the database
    storeTeams();
  }
});

// Initialize database with Conversation stats
db.count({type: 'status'}, (countErr, count) => {
  console.log(`There are ${count} status rows in the database`);
  if (countErr) console.log('There\'s a problem with the database: ', countErr);
  else if (count <= 0) { // empty database so needs populating
    // default users inserted in the database
    db.insert(defaultStatusRecords, (insertErr, recordsAdded) => {
      if (insertErr) console.log('There\'s a problem with the database: ', insertErr);
      else if (recordsAdded) console.log('Default statuses inserted in the database');
    });
  }
});

// Array of team name strings to monitor, default is all teams
let monitoredTeams = [];

// Callback to list() on interval get Intercom data
// setInterval(list, 1000 * 60 * 10 );
// setInterval(list, 3000 );

function failureCallback(result) {
  console.log(`Handle rejected promise (${result})`);
}

// Call intercom for all admins, which includes teams
function storeTeams() {
  client.admins.list().then(
    (firstPage) => {
      const teams = firstPage.body.admins.filter(admin => admin.type === 'team');
      console.log(teams);
      return teams;
    },
    ).then(
      (teams) => {
        teams.forEach((team) => {
          db.insert(team, (insertErr, recordsAdded) => {
            if (insertErr) console.log('There\'s a problem with the database: ', insertErr);
            else if (recordsAdded) console.log('Team inserted in the database');
          });
        });
      },
      ).catch(failureCallback);
    }

// Store status record
function storeStatus(statusRecord) {
  db.insert(statusRecord, (insertErr, recordsAdded) => {
    if (insertErr) console.log('There\'s a problem with the database: ', insertErr);
    else if (recordsAdded) console.log('Status inserted in the database');
  });
}

// Maps converstation data to simple counts for each team name
const mapConvoStats = (data) => {
  // First, finding all teams in database
  db.find({ type: 'team' }, (findErr, docsFound) => {
    if (findErr) console.log('There\'s a problem with the database: ', findErr);
    else if (docsFound) {
      // Reduce all conversation data down to counts per team ID
      const reducedData = data.reduce((acc, convo) => {
        const incrementKey = [convo.assignee.id || convo.assignee.type];
        typeof acc[incrementKey] === 'undefined' ? acc[incrementKey] = 1 : acc[incrementKey]++
        return acc;
      }, {});
      // Create a new pretty count object to store
      const statusRecord = new StatusRecord('status', Date.now(), {}, 0);
      // Format team names and collate with team id convo counts
      docsFound.forEach((doc) => {
        statusRecord.data[unescape(doc.name)] = reducedData[doc.id] ? reducedData[doc.id] : 0;
      });
      // Reduce all team count values to total
      statusRecord.total = Object.values(statusRecord.data).reduce((acc, count) => acc + count);
      storeStatus(statusRecord);
    }
  });
};

const getLastStatus = () => new Promise((resolve, reject) => {
  db.findOne({ type: 'status' }).sort({ timestamp: -1 }).exec((findErr, docsFound) => {
    findErr ? reject(`Problem with the database: ${findErr}`) : docsFound ? resolve(docsFound) : null
  });
});

// Paginate through Intercom nextPage objects recursively
function getMorePages(page, conversationData) {
  client.nextPage(page).then(
    (nextPage) => {
      const converationCollection = conversationData.concat(nextPage.body.conversations);
      if (nextPage.body.pages.next) {
        getMorePages(nextPage.body.pages, converationCollection);
      } else {
        mapConvoStats(converationCollection);
      }
      return converationCollection;
  },
  ).catch(failureCallback);
}

// Call intercom for first page converations and paginate if more results exist
function listConversations() {
  client.conversations.list({ open: true, per_page: 20 }).then(
    (firstPage, conversationData = []) => {
      const conversationDataSingle = conversationData.concat(firstPage.body.conversations);
      if (firstPage.body.pages.next) {
        getMorePages(firstPage.body.pages, conversationDataSingle);
      } else {
        mapConvoStats(conversationDataSingle);
      }
      return conversationDataSingle;
    },
    ).catch(failureCallback);
}

listConversations();
getLastStatus().then((lastStat) => { console.log('💓', lastStat); });

/* // When given case ID, get and send all case, customer, and assigned user details to slack
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
} */

// Return help text to client with examples of proper usage
function help(res) {
  const helpText = 'Type `/support` for status accross all filters. Add a case link `https://app.intercom.io/a/apps/x2byp8hg/inbox/inbox/1935680/conversations/18437669699` or an email `hello@gmail.com` to get specific.';
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
      // get last status from database
      getLastStatus().then((lastStat) => {
        console.log("🐒", lastStat);
        res.send(
          {
            response_type: 'ephemeral',
            text: `hello ${lastStat}`,
          },
        );
      }).catch(failureCallback);
    // validates a full Intercom link exists in command text
    } else if (/^[0-9]{1,7}$/.test(req.body.text.split('conversations/')[1])) {
      // caseAttachment(req.body.text.split('conversations/')[1]);
      // validates email
    } else if (/([\w\.]+)@([\w\.]+)\.(\w+)/.test(req.body.text)) {
      // emailSearch(req.body.text);
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
