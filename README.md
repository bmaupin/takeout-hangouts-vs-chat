## What is this?

A small project to compare Google Chat and Google Hangouts data exported from Google Takeout.

Why?

> ... some conversations or portions of conversations won’t automatically migrate from Hangouts to Chat.
>
> ... download a copy before January 1, 2023, when Hangouts data will be deleted.

([https://support.google.com/chat/answer/9854901](https://support.google.com/chat/answer/9854901))

#### Usage

1. Export your data

   ⓘ Do this right away as it can take hours before the data download is ready

   1. Go to [https://takeout.google.com/](https://takeout.google.com/)

   1. Click _Deselect all_ (near the top) then check _Google Chat_ and _Hangouts_

   1. Click _Next step_ (near the bottom) and follow the instructions to create the export

## Notes

- All Hangouts messages are in one file (Takeout/Google Hangouts/Hangouts.json), split by conversation
  - Hangouts conversations have a unique ID
    - This does not seem to match the group ID in Chat
- Takeout messages are split by group
  - Takeout group IDs are in the directory name of the group

#### Matching Hangouts conversations to Chat messages

- Match Hangouts conversation.events.timestamp (Epoch milliseconds, e.g. `new Date(hangoutsTimestamp/1000)`) to Takeout messages[...].created_date
- Match Hangouts conversation.events.chat_message.message_content.segment[...].text (where segment[...].type === 'TEXT') to Takeout messages[...].text
- Match Hangouts conversation.conversation.participant_data[...].fallback_name to Takeout messages[...].creattor.name?
  - We could then create a dictionary of participants with their names, and unique IDs in Hangouts and email in Takeout, as a way of making sure they're property matched

#### Ideas

Simplest approach:

1. Parse all Hangouts messages (since they're in one file)
1. Go through Chat messages one-by-one
1. Match each individual Chat message with one in Hangouts
   - Record this somewhere
1. Finally, go back over all messages in Hangouts again and dump the unmatched ones
   - Skip non-text messages

More complex idea:

1. Go through one-on-one messages
   - In Chat, directory starts with DM
     - members in group_info.json also has 2 elements
   - In Hangouts, conversation.conversation.type is `STICKY_ONE_TO_ONE`
1. For each group in Chat, find that conversation in Hangouts
   1. Match the timestamps and text
   1. Match the username, and then save the participant ID mapping from Chat to Hangouts in a separate file (overkill?)
1. Go through group messages
   - In Chat, directory starts with `Space`
     - members in group_info.json also has more than 2 elements
   - In Hangouts, conversation.conversation.type is `GROUP`
