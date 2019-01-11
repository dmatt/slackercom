# slackercom
A configurable Slack "slash command" for intercom conversation data.

## Commands:
- `/support` - default command returns conversation counts for all teams. You can also restrict to a chosen list of teams by editing `monitoredTeams`
- `/support https://app.intercom.io/a/apps/[app-id-redacted]/inbox/inbox/conversation/15929788631` - returns entire conversation that matches ID, if `#part_id=user-message-15929788631-202241720` is provided in the URL, just that message will be returned.
- `/support help` - returns help with commands
- TODO: `/support example@gmail.com` - returns most recent conversation that matches email provided

## Configuration:

1. Create your custom [Slack slash command](https://api.slack.com/slash-commands) configuration.
2. Add the following environment variables from your Intercom and Slack app:

  - consumer_key
  - consumer_secret
  - token
  - token_secret
  - slack_token
  - SLACK_WEBHOOK
  
Remixed from [older version[(https://glitch.com/~tickets) that integrated with Desk.com intead of Intercom.