// 👀 Current status: working on getting single convo

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
// caseAttachment() - case link with ID

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

db.ensureIndex({ fieldName: 'type', expireAfterSeconds: 300000 }, (err) => {
  if (err) console.log('There\'s a problem with the database: ', err);
});

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

// Array of team name strings to monitor, if empty formatForSlack() will return all
const monitoredTeams = [
  'Commenters',
  'DMCA',
  'Publisher Success',
  'Priority Support',
  'Community Publishers',
  'Payments',
  'Direct Support',
  'Delete & Access',
];

const failureCallback = (result) => {
  console.log(`Handle rejected promise (${result})`);
};

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
        // make the assignedTo key either the assignee or "nobody_admin" if no id exists (unassigned)
        const assignedTo = convo.assignee.id || convo.assignee.type;
        acc[assignedTo] == undefined ? acc[assignedTo] = 1 : acc[assignedTo]++;
        return acc;
      }, {});
      // Create a new pretty count object to store
      const statusRecord = new StatusRecord('status', Date.now(), {}, 0);
      // Format team/assignee names and if the assignee id is present in reduced convo counts set to that count, else set to 0 (no open cases)
      docsFound.forEach((assignee) => {
        statusRecord.data[unescape(assignee.name)] = reducedData[assignee.id] ? reducedData[assignee.id] : 0;
      });
      // Reduce all team count values for a total 
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
  client.conversations.list({ state: "open", per_page: 20 }).then(
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

// Callback to listConversations() every 10 min. to store new Intercom data
setInterval(listConversations, 300000 );
// Callback to removeOldRecords() every 10 min. so Glitch 512MB memory doesn't max out
// setInterval(removeOldRecords, 300000 );

// listConversations();
getLastStatus().then((lastStat) => { console.log('💓', lastStat); });

// When given conversation ID, get and send all case, customer, and assigned user details to slack
const getConversation = (id) => new Promise((resolve, reject) => {
  // ignore the conversation part id if that exists
  let conversationId = id.split('#') ? id.split('#')[0] : id;
  // https://app.intercom.io/a/apps/x2byp8hg/inbox/inbox/1935680/conversations/18437669699
  client.conversations.find({ id: conversationId }).then(
    (conversation) => {
      resolve(conversation.body.conversation_message.body)
    },
    ).catch(failureCallback);
});

/* 

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

// return true if team name is in the monitored list, default is true if there are no teams to monitor
const isMonitoredTeam = (team) => {
  return monitoredTeams.length && !monitoredTeams.includes(team) ? false : true;
}

// TODO: create a better message structure: monitored teams, on-fire, last touched
function formatForSlack(statusRecord) {
  const attachments = [];
  const teamConvoCounts = statusRecord.data;
  let monitoredTeamsTotal = 0;
  Object.keys(teamConvoCounts).map((objectKey) => {
    const addAttachment = () => {
      monitoredTeamsTotal += teamConvoCounts[objectKey]
      attachments.push({
        fallback: `${objectKey}: ${teamConvoCounts[objectKey]}`,
        color: '#7fbd5a',
        title: `${objectKey}: ${teamConvoCounts[objectKey]}`,
        // 'text': stats[objectKey][1] + ' new, ' + stats[objectKey][2] + ' open'
      });
    };
    // Add the team stats to message only if actively monitoring
    if (isMonitoredTeam(objectKey)) {
      addAttachment()
    }
  });
  const message = {
    response_type: 'in_channel',
    text: `${monitoredTeamsTotal} open coversations right now.`,
    attachments,
  };
  return message;
}

function formatSingleConvoForSlack(conversation) {
  const attachments = [];
      attachments.push({
        fallback: `${conversation}`,
        color: '#7fbd5a',
        title: `${conversation}`,
        // 'text': stats[objectKey][1] + ' new, ' + stats[objectKey][2] + ' open'
      });
  const message = {
    response_type: 'in_channel',
    text: `hi`,
    attachments,
  };
  return message;
}

// Handler of post requests to server, checks request text to trigger different functions
app.post('/', (req, res) => {
  // Check the slack token so that this request is authenticated
  if (req.body.token === process.env.SLACK_TOKEN) {
    // Detect which command was entered in slack and call the correct function
    if (req.body.text.length < 1) {
      // get last status from database
      getLastStatus().then((lastStat) => {
        const lastStatFormatted = formatForSlack(lastStat);
        res.send(lastStatFormatted);
      }).catch(failureCallback);
    // validates a full Intercom link exists in command text
    } else if (req.body.text.split('conversation/')[1] > 1) {
      // get last status from database
      getConversation(req.body.text.split('conversation/')[1]).then((conversation) => {
        res.send(formatSingleConvoForSlack(conversation));
      }).catch(failureCallback);
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

// Local debug listen for requests :)
const listener = app.listen(process.env.PORT || 53923, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});
