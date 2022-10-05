## About

A small project to compare Google Chat and Google Hangouts data exported from Google Takeout.

#### Summary

I started this project as a way to try to match each message from Chat in Hangouts but in the end it there are too many edge cases to handle and it runs way too slow (and isn't worth optimizing). So I settled for a count of the overall messages:

```
$ npx ts-node src/compare-takeout-hangouts-chat.ts ~/Desktop/Takeout/
Found 212709 Hangouts messages
Found 211462 Chat messages
99.41% Hangouts messages in Chat
```

It looks like nearly all the messages from Hangouts were transferred to Chat.

**However,** images, videos, and other media in Hangouts messages may not have been transferred:

```
$ du -sh Takeout/*
178M    Takeout/Google Chat
21G     Takeout/Google Hangouts
```

More information: [Some notes on Google Takeout + Hangouts/Google Chat](https://www.reddit.com/r/DataHoarder/comments/ub7iar/some_notes_on_google_takeout_hangoutsgoogle_chat/)

#### Why?

> ... some conversations or portions of conversations won’t automatically migrate from Hangouts to Chat.
>
> ... download a copy before January 1, 2023, when Hangouts data will be deleted.

([https://support.google.com/chat/answer/9854901](https://support.google.com/chat/answer/9854901))

#### Usage

1. Export your data

   ⓘ Do this right away as it can take hours before the data download is ready

   1. Go to [https://takeout.google.com/?hl=en](https://takeout.google.com/?hl=en)

      ⚠ Make sure to use this exact link as it sets the language to English so that the Google Chat timestamp format will be in English, which is what this script expects

   1. Click _Deselect all_ (near the top) then check _Google Chat_ and _Hangouts_

   1. Click _Next step_ (near the bottom) and follow the instructions to create the export

1. Download the data, extract, run this script, e.g.

   ```
   npx ts-node src/compare-takeout-hangouts-chat.ts /path/to/Takeout/
   ```
