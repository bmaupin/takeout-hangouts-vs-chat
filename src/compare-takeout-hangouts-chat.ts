// To run this script: npx ts-node src/compare-takeout-hangouts-chat.ts

import { readdir, readFile } from 'fs/promises';
import path from 'path';

const main = async () => {
  if (process.argv.length !== 3) {
    console.log('Error: Please provide the path to the Takeout directory');
    process.exit(1);
  }

  const takeoutDirectory = process.argv[2];

  const hangoutsConversations = await readJSONFile(
    path.join(takeoutDirectory, 'Google Hangouts/Hangouts.json')
  );
  console.log(
    `Found ${hangoutsConversations.conversations.length} Hangouts conversations`
  );

  const chatGroups = await readdir(
    path.join(takeoutDirectory, 'Google Chat/Groups')
  );
  console.log(`Found ${chatGroups.length} Chat groups`);

  for (const chatGroup of chatGroups) {
    // TODO: remove this
    console.log('chatGroup=', chatGroup);
    let matchedCount = 0;
    // TODO: remove this restriction
    if (chatGroup.startsWith('DM')) {
      const chatGroupMessages = await readJSONFile(
        path.join(
          takeoutDirectory,
          'Google Chat/Groups',
          chatGroup,
          'messages.json'
        )
      );

      for (const chatMessage of chatGroupMessages.messages) {
        if (chatMessage.text) {
          if (isChatMessageInHangoutsData(chatMessage, hangoutsConversations)) {
            matchedCount++;
          }
        }
      }
    }
    // TODO: remove this once we get it working
    console.log('matchedCount=', matchedCount);
    break;
  }
};

const readJSONFile = async (pathToFile: string) => {
  const rawHangoutsFile = await readFile(pathToFile, 'utf8');
  return JSON.parse(rawHangoutsFile);
};

// const readTakeout;

// Parse a timestamp from Google Chat data, e.g. "Wednesday, September 30, 2015 at 5:53:40 PM UTC"
// NOTE the timestamp must be in English, otherwise the parsing will fail
const parseChatTimestamp = (timestamp: string) => {
  return Number(new Date(timestamp.replace('at ', '')));
};

// Parse a timestamp from Google Hangouts, which is the epoch time in microseconds
const parseHangoutsTimestamp = (timestamp: number) => {
  return Math.floor(timestamp / 1000000) * 1000;
};

const isChatMessageInHangoutsData = (chatMessage: any, hangoutsData: any) => {
  for (const hangoutsConversation of hangoutsData.conversations) {
    for (const hangoutsEvent of hangoutsConversation.events) {
      // console.log('hangoutsEvent=', hangoutsEvent);
      // break;
      // TODO: need to handle Hangouts message segments

      // if (!hangoutsEvent.chat_message?.message_content.segment) {
      //   console.log('hangoutsEvent=', hangoutsEvent);
      //   break;
      // }

      if (
        // TODO: timestamps can be rounded up or down? this seems to work, but keep it disabled for now
        // (parseHangoutsTimestamp(hangoutsEvent.timestamp) ===
        //   parseChatTimestamp(chatMessage.created_date) ||
        //   parseHangoutsTimestamp(hangoutsEvent.timestamp) + 1000 ===
        //     parseChatTimestamp(chatMessage.created_date)) &&
        hangoutsEvent.chat_message?.message_content.segment &&
        hangoutsEvent.chat_message?.message_content.segment[0].text ===
          chatMessage.text
      ) {
        console.log(hangoutsEvent);
        console.log(hangoutsEvent.chat_message?.message_content.segment);
        console.log(chatMessage);
        return true;
      }
    }
  }

  return false;
};

main();