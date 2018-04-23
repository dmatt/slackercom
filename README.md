# slackercom
A configurable Slack "slash command" for intercom conversation data. Remixed from older version that integrated with Desk.com.

## Commands:
- `/support` - default command returns conversation counts for all teams. ❌ or restrict a list of teams by editing `monitoredTeams`
- `/support https://app.intercom.io/a/apps/[app-id-redacted]/inbox/inbox/conversation/15929788631` - returns entire conversation that matches ID, ❌ if `#part_id=user-message-15929788631-202241720` is provided in the URL, just that message will be returned.
- `/support example@gmail.com` - returns most recent conversation that matches email provided
- `/support help` - returns help with commands

## Configuration:

1. Create your custom [Slack slash command](https://api.slack.com/slash-commands) configuration.
2. Add the following environment variables from your Intercom and Slack app:

  - subdomain
  - consumer_key
  - consumer_secret
  - token
  - token_secret
  - slack_token
  
3. Configure the following variables and functions in `app.js` to GET your desired data from Desk
   
  - `statusParams` - Object of criteria for `cases` API call via `deskCall()`, parameters available: http://dev.desk.com/API/cases/#fields
  - `createStats()` - Array.prototype.filter() tests to further segment data from `deskCall()` into specific filters
  - stats - Object of filter names and variables defined in `createStats()` to output up to 20 Slack attachments