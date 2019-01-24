# slackercom
A configurable Slack "slash command" to retrieve intercom team status and conversations.

## Commands:
- `/support` - default command returns conversation counts for all teams. You can also restrict to a chosen list of teams by editing `monitoredTeams`
- `/support https://app.intercom.io/a/apps/[app-id-redacted]/inbox/inbox/conversation/15929788631` - returns entire conversation that matches ID, if `#part_id=user-message-15929788631-202241720` is provided in the URL, just that message will be returned.
- `/support help` - returns help with commands
- NOTE: the email lookup method `/support example@gmail.com` is currently not implemented because in the Intercom API the email must belong to a user, or the lead unique id must be known. Maybe: look up user conversations by email, if that doesn't exist, look up lead by email, use that lead id to look up conversation by lead id, if that doesnt exist return nothing.

## Configuration:

1. Create your custom [Slack slash command](https://api.slack.com/slash-commands) configuration.
2. Add the following environment variables from your Intercom and Slack app:

### Intercom
Instructions at [https://developers.intercom.com/building-apps/docs/authorization#section-access-tokens](https://developers.intercom.com/building-apps/docs/authorization#section-access-tokens), you can adjust the app to only use Read permissions

`INTERCOM_TOKEN=`

### Slack
Go to [https://disqus.slack.com/apps/manage/custom-integrations](https://disqus.slack.com/apps/manage/custom-integrations) > Slash Commands > Edit > Token

`SLACK_TOKEN=`

Remixed from [older version](https://glitch.com/~tickets) that integrated with Desk.com intead of Intercom.