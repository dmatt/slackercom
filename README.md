# tickets
Slash command handler for Disqus slack.

## Commands:
- `/support` - default command returns case status of all important Desk filters
- `/support https://help.disqus.com/agent/case/347519` - returns case that matches ID provided 0-7 characters in length
- `/support example@gmail.com` - returns most recent case that matches email provided
- `/support help` - returns help with commands

## Configuration:

1. Create your custom [Slack slash command](https://api.slack.com/slash-commands) configuration.
2. Add the following environment variables from your Desk and Slack app:

  - subdomain
  - consumer_key
  - consumer_secret
  - token
  - token_secret
  - slack_token
  - sheet_key (optional)
  
3. Configure the following variables and functions in `app.js` to GET your desired data from Desk
   
  - `statusParams` - Object of criteria for `cases` API call via `deskCall()`, parameters available: http://dev.desk.com/API/cases/#fields
  - `createStats()` - Array.prototype.filter() tests to further segment data from `deskCall()` into specific filters
  - stats - Object of filter names and variables defined in `createStats()` to output up to 20 Slack attachments