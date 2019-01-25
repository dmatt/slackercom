// 👀 Current status: removed email lookup

const express = require('express');
const bodyParser = require('body-parser');
const Intercom = require('intercom-client');
const glitchup = require('glitchup');
const Datastore = require('nedb'); // setup a new database
const unescape = require('unescape');
const TurndownService = require('turndown');
const request = require('request');

const app = express();
const client = new Intercom.Client({ token: process.env.INTERCOM_TOKEN });
const db = new Datastore({ filename: '.data/datafile', autoload: true });

const turndownService = new TurndownService()

// Express middleware for parsing request/resonse bodies
app.use(bodyParser.urlencoded({ extended: false }));

// prevent server from sleeping
glitchup();

// the "model" for team status data record
class StatusRecord {
  constructor(type, timestamp, data, total) {
    this.type = type;
    this.timestamp = timestamp;
    this.data = data;
    this.total = total;
  }
}

// Sets a TTL for all rows to expire so that oldest rows are flushed out after 300000 seconds
db.ensureIndex({ fieldName: 'type', expireAfterSeconds: 300000 }, (err) => {
  if (err) console.log('There\'s a problem with the database: ', err);
});

// Manually remove all team data if you need to refresh your team list (i.e. after adding a new team) 
function removeTeams() { 
  db.remove({ type: { $in: ['team'] }}, { multi: true }, function (err, numRemoved) {
  console.log(numRemoved)
});
}

// removeTeams()

// default conversations status data with some placeholder data
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
let monitoredTeams = [
  // Example:
  // 'Priority',
  // 'Partners',
  // 'Paid customers',
];

// This reassignment should be intentionally ignored if you leave DISQUS_TOKEN blank
if (process.env.DISQUS_TOKEN == 'hellofromdisqus') {
  monitoredTeams = [
    'Commenters',
    'DMCA',
    'Publisher Success',
    'Priority Support',
    'Community Publishers',
    'Payments',
    'Direct Support',
    'Delete & Access',
  ];
}

const failureCallback = (result) => {
  let failureMessage = {
    response_type: 'ephemeral',
    text: `Sorry, something didn't work right: ${result}`,
  };
  console.log(`Handle rejected promise (${result})`);
  postToSlack(failureMessage, response_url);
};

// Call intercom for all admins, which includes teams
function storeTeams() {
  client.admins.list().then(
    (firstPage) => {
      const teams = firstPage.body.admins.filter(admin => admin.type === 'team');
      return teams;
    },
    ).then(
      (teams) => {
        teams.forEach((team) => {
          console.log(team)
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

// Get the most recent status record from database, used by slash command for quick responses
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
// listConversations();
setInterval(listConversations, 300000 );

// When given conversation ID, get and send all case, customer, and assigned user details to slack
const getConversationById = (id) => new Promise((resolve, reject) => {
  let conversationId = id.split('#part_id=')[0];
  let partId = id.includes('#part_id=') ? id.split('#part_id=')[1].split(`${conversationId}-`)[1] : null;
  client.conversations.find({ 'id': conversationId, 'display_as': 'plaintext' }).then(
    (conversation) => {
      if (partId) {
        conversation.body.chosen_conversation_part = partId;
      }
      resolve(conversation.body)
    },
    ).catch(failureCallback);
});

// Return help text to client with examples of proper usage
function help() {
  let helpMessage = {
    response_type: 'ephemeral',
    text: 'Type `/support` for the status of all monitored teams. Add a conversation link `https://app.intercom.io/a/apps/x2byp8hg/inbox/inbox/1935680/conversations/18437669699` to return the message.',
  };
  return helpMessage
}

// Return help text to client with examples of proper usage
function badCommand() {
  let badCommandMessage = {
    response_type: 'ephemeral',
    text: 'Sorry bub, I\'m not quite following. Type `/support help` to see what I can understand.',
  };
  return badCommandMessage
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
        color: teamConvoCounts[objectKey] < 10 ? '#7fbd5a' : '#e76c35' ,
        title: `${objectKey}: ${teamConvoCounts[objectKey]}`,
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

// grab the first conversation part where the author is the customer
const getSpecificMessage = (body) => {
  let customerIndicator = ['lead','user']
  if (body.chosen_conversation_part) {
    return body.conversation_parts.conversation_parts.filter(part => part.id === body.chosen_conversation_part)[0];
  } else if (customerIndicator.includes(body.conversation_message.author.type)) {
    return body.conversation_message
  }
  return body.conversation_parts.conversation_parts.filter(part => customerIndicator.includes(part.author.type))[0]
}

function formatSingleConvoForSlack(conversation) {
  let specificMessage = getSpecificMessage(conversation)
  let body = specificMessage.body
  let subject = conversation.conversation_message.subject
  let timestamp = specificMessage.created_at
  let ratingMap = ['😠','🙁','😐','😃','🤩']
  let rating = (conversation.conversation_rating.rating !== null) ? ratingMap[conversation.conversation_rating.rating - 1] : 'Not yet rated';
  const attachments = [
        {
            "fallback": `${body}`,
            "color": "#36a64f",
            // "author_name": `${conversation.user.id}`,
            "title": `${subject}`,
            "title_link": `${'https://app.intercom.io/a/apps/x2byp8hg/inbox/inbox/conversation/' + conversation.id}`,
            "text": `${body}`,
            "fields": [
                {
                    "title": "Status",
                    "value": `${conversation.state}`,
                    "short": true
                },
                {
                    "title": "Rating",
                    "value": `${rating}`,
                    "short": true
                }
            ],
            "footer": "Slackercom",
            "footer_icon": "https://cdn.glitch.com/project-avatar/e899f9c6-39d0-4acf-abe0-e0d88c21c524.png?1524523219471",
            "ts": timestamp
        }
    ];
  const message = {
    response_type: 'in_channel',
    attachments,
  };
  return message;
}

// Handles async requests back to slack after a command is handled and completed
let postToSlack = (message, response_url ) => {
  request.post({
    url: response_url,
    json: message
  }, function(err,httpResponse,body) {
    if (err) {
      failureCallback(err);
    }
  })
}

// global response_url to use in failure callbacks
let response_url

// Handler of post requests to server, checks request text to trigger different functions
app.post('/', (req, res) => {
  response_url = req.body.response_url;
  // Check the slack token so that this request is authenticated
  if (req.body.token === process.env.SLACK_TOKEN) {
    // Send an acknowledgement immediately, then finish async command and POST to `response_url`
    res.send({response_type: 'ephemeral', text: '🤔'});
    // Different commands that can be attached to `/support`
    let conversationId = req.body.text.split(/conversations\/|conversation\//)[1];
    let isEmptyCommand = (req.body.text.length < 1);
    let isHelp = (req.body.text === 'help')
    // call the correct function for each command
    if (isEmptyCommand) {
      // get last status from database
      getLastStatus().then((lastStat) => {
        const lastStatFormatted = formatForSlack(lastStat);
        postToSlack(lastStatFormatted, req.body.response_url);
      }).catch(failureCallback);
    // validates a full Intercom link exists in command text
    } else if (conversationId) {
      // search the conversation ID in Intercom API
      getConversationById(conversationId).then((conversation) => {
        postToSlack(formatSingleConvoForSlack(conversation), req.body.response_url);
      }).catch(failureCallback);
      // validates email
    } else if (isHelp) {
      postToSlack(help(res), req.body.response_url);
    } else {
      postToSlack(badCommand(), req.body.response_url);
    }
  // Request does not have token so it is not authenticated
  } else {
    res.send(
      {
        response_type: 'ephemeral',
        text: 'Wow, such unauthorized. Make sure your secret Slack token is correctly set.',
      },
    );
  }
});

/* Example of how to log the last 10 status
const logLastTenStatus = () => {
  // First, finding all teams in database
  db.find({ type: 'status' }).sort({ timestamp: -1 }).limit(10).exec(function (findErr, docsFound) {
    if (findErr) console.log('There\'s a problem with the database: ', findErr);
    else if (docsFound) {
      console.log(docsFound)
    }
  });
};
*/

// Local debug listen for requests :)
const listener = app.listen(process.env.PORT || 53923, () => {
  console.log(`Your app is listening on port ${listener.address().port}`);
});
