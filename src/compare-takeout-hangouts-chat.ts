// To run this script: npx ts-node src/compare-takeout-hangouts-chat.ts

import { readdir, readFile } from 'fs/promises';
import path from 'path';

interface GoogleChatMessageAnnotation {
  url_metadata?: {
    url: {
      private_do_not_access_or_else_safe_url_wrapped_value: string;
    };
  };
}

interface GoogleChatMessage {
  annotations?: GoogleChatMessageAnnotation[];
  created_date?: string;
  previous_message_versions?: GoogleChatMessage[];
  text: string;
}

interface HangoutsMessageSegment {
  text?: string;
  type: string;
}

interface HangoutsEvent {
  chat_message?: {
    message_content: {
      segment: HangoutsMessageSegment[];
    };
  };
  event_id: string;
  event_type: string;
  timestamp: number;
}

const main = async () => {
  if (process.argv.length !== 3) {
    console.log('Error: Please provide the path to the Takeout directory');
    process.exit(1);
  }

  const takeoutDirectory = process.argv[2];

  const hangoutsData = await readJSONFile(
    path.join(takeoutDirectory, 'Google Hangouts/Hangouts.json')
  );
  console.log(
    `Found ${hangoutsData.conversations.length} Hangouts conversations`
  );

  const chatGroups = await readdir(
    path.join(takeoutDirectory, 'Google Chat/Groups')
  );
  console.log(`Found ${chatGroups.length} Chat groups`);

  const matchedEventIds: string[] = [];

  for (const chatGroup of chatGroups) {
    // TODO: remove all this?
    let matchedCount = 0;
    let messageCount = 0;

    // TODO: remove this restriction
    // if (chatGroup.startsWith('DM')) {
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
        !chatMessage.annotations?.[0].url_metadata?.url.private_do_not_access_or_else_safe_url_wrapped_value.startsWith(
          'https://hangouts.google.com'
        )
      ) {
        messageCount++;
        if (deleteMatchingMessage(chatMessage, hangoutsData, matchedEventIds)) {
          matchedCount++;
          // DEBUGGING: Get a count of all Hangouts messages
          // console.log(
          //   'Hangouts events:',
          //   hangoutsConversations.conversations.reduce(
          //     (count: number, conversation: any) =>
          //       count + conversation.events.length,
          //     0
          //   )
          // );
        }
      }
    }
    // }

    console.log(
      `Matched ${matchedCount}/${messageCount} text messages in group ${chatGroup}`
    );
    // TODO: delete this
    // break;
  }

  console.log('Finished matching messages');

  for (const hangoutsConversation of hangoutsData.conversations) {
    for (const hangoutsEvent of hangoutsConversation.events as HangoutsEvent[]) {
      if (
        matchedEventIds.includes(hangoutsEvent.event_id) ||
        !hangoutsEvent.chat_message
      ) {
        continue;
      }

      console.log('Unmatched Hangouts message:', hangoutsEvent);
    }
  }
};

const readJSONFile = async (pathToFile: string) => {
  const rawHangoutsFile = await readFile(pathToFile, 'utf8');
  return JSON.parse(rawHangoutsFile);
};

const deleteMatchingMessage = (
  chatMessage: GoogleChatMessage,
  hangoutsData: any,
  matchedEventIds: string[]
) => {
  for (const hangoutsConversation of hangoutsData.conversations) {
    for (const [i, hangoutsEvent] of (
      hangoutsConversation.events as HangoutsEvent[]
    ).entries()) {
      // NOTE: interestingly enough, skipping event IDs in matchedEventIds slows this
      // down a lot! (so don't do it 😉)
      if (
        doTimeStampsMatch(chatMessage, hangoutsEvent) &&
        doesMessageTextMatch(chatMessage, hangoutsEvent)
      ) {
        // console.log(hangoutsEvent);
        // console.log(hangoutsEvent.chat_message?.message_content.segment);
        // console.log(chatMessage);
        // matchedEventIds.push(hangoutsEvent.event_id);

        // Delete the matched event from the Hangouts data
        hangoutsConversation.events.splice(i, 1);

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
  let createdDate = '';

  if (chatMessage.created_date) {
    createdDate = chatMessage.created_date;
  } else if (chatMessage.previous_message_versions?.[0].created_date) {
    createdDate = chatMessage.previous_message_versions[0].created_date;
  } else {
    return false;
  }

  return (
    Math.abs(
      parseHangoutsTimestamp(hangoutsEvent.timestamp) -
        parseChatTimestamp(createdDate)
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
