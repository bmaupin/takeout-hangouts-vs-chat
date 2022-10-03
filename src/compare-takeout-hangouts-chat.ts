// To run this script: npx ts-node src/compare-takeout-hangouts-chat.ts

import { readdir, readFile } from 'fs/promises';
import path from 'path';

interface GoogleChatMessageAnnotation {
  url_metadata: {
    url: {
      private_do_not_access_or_else_safe_url_wrapped_value: string;
    };
  };
}

interface GoogleChatMessage {
  annotations?: GoogleChatMessageAnnotation[];
  created_date: string;
  text: string;
}

interface HangoutsMessageSegment {
  text: string;
  type: string;
}

interface HangoutsEvent {
  chat_message?: {
    message_content: {
      segment: HangoutsMessageSegment[];
    };
  };
  timestamp: number;
}

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
    // TODO: remove all this?
    let matchedCount = 0;
    let messageCount = 0;

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

      for (const chatMessage of chatGroupMessages.messages as GoogleChatMessage[]) {
        if (
          chatMessage.text &&
          // Filter out Hangouts calls after the Chat migration
          !chatMessage.text.startsWith(
            'System message: A call has been attempted from Hangouts.'
          ) &&
          !chatMessage.text.startsWith(
            'Message système : Vous avez essayé de passer un appel à partir de Hangouts.'
          ) &&
          // Filter out links to Hangouts calls
          !chatMessage.annotations?.[0].url_metadata.url.private_do_not_access_or_else_safe_url_wrapped_value.startsWith(
            'https://hangouts.google.com'
          )
        ) {
          messageCount++;
          if (isChatMessageInHangoutsData(chatMessage, hangoutsConversations)) {
            matchedCount++;
          }
        }
      }
    }

    console.log(
      `Matched ${matchedCount}/${messageCount} text messages in group ${chatGroup}`
    );
    break;
  }
};

const readJSONFile = async (pathToFile: string) => {
  const rawHangoutsFile = await readFile(pathToFile, 'utf8');
  return JSON.parse(rawHangoutsFile);
};

const isChatMessageInHangoutsData = (
  chatMessage: GoogleChatMessage,
  hangoutsData: any
) => {
  for (const hangoutsConversation of hangoutsData.conversations) {
    for (const hangoutsEvent of hangoutsConversation.events as HangoutsEvent[]) {
      if (
        doTimeStampsMatch(chatMessage, hangoutsEvent) &&
        doesMessageTextMatch(chatMessage, hangoutsEvent)
      ) {
        // console.log(hangoutsEvent);
        // console.log(hangoutsEvent.chat_message?.message_content.segment);
        // console.log(chatMessage);
        return true;
      }
    }
  }

  // console.log(hangoutsEvent);
  // console.log(hangoutsEvent.chat_message?.message_content.segment);
  console.log(chatMessage);
  return false;
};

// Convert timestamps and compare them; they can differ by up to 2 seconds 🤷‍♂️
const doTimeStampsMatch = (
  chatMessage: GoogleChatMessage,
  hangoutsEvent: HangoutsEvent
): boolean => {
  return (
    Math.abs(
      parseHangoutsTimestamp(hangoutsEvent.timestamp) -
        parseChatTimestamp(chatMessage.created_date)
    ) < 2000
  );
};

// Parse a timestamp from Google Hangouts, which is the epoch time in microseconds
const parseHangoutsTimestamp = (timestamp: number) => {
  return timestamp / 1000;
};

// Parse a timestamp from Google Chat data, e.g. "Wednesday, September 30, 2015 at 5:53:40 PM UTC"
// NOTE the timestamp must be in English, otherwise the parsing will fail
const parseChatTimestamp = (timestamp: string) => {
  return Number(new Date(timestamp.replace('at ', '')));
};

const doesMessageTextMatch = (
  chatMessage: GoogleChatMessage,
  hangoutsEvent: HangoutsEvent
): boolean => {
  const chatMessageText = chatMessage.text;
  const hangoutsMessageText = joinHangoutsMessageSegments(hangoutsEvent);

  return chatMessageText === hangoutsMessageText;
};

const joinHangoutsMessageSegments = (hangoutsEvent: HangoutsEvent): string => {
  let previousPreviousSegmentText = '';
  let previousSegmentText = '';

  const joinedMessageSegments =
    hangoutsEvent.chat_message?.message_content.segment
      ?.map((segment: any) => {
        // This is a weird one; in some rare occasions, a link will appear twice separated
        // by a newline, only in Hangouts
        if (
          segment.type === 'LINK' &&
          segment.text === previousPreviousSegmentText &&
          previousSegmentText === '\n'
        ) {
          return 'DELETEME';
        }

        // Some segments have missing line breaks
        if (segment.type === 'LINE_BREAK' && !segment.text) {
          segment.text = '\n';
        }

        previousPreviousSegmentText = previousSegmentText;
        previousSegmentText = segment.text;

        return segment.text;
      })
      .join('') || '';

  return joinedMessageSegments.replace('\nDELETEME', '');
};

main();
