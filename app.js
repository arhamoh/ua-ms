const { App } = require('@slack/bolt');
require('dotenv').config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
  const today = todayStr();
  if (dateStr === today) return `Today (${dateStr})`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0];
  if (dateStr === yStr) return `Yesterday (${dateStr})`;
  return dateStr;
}

function calcHoursDecimal(checkInDate, checkInTime, checkOutDate, checkOutTime) {
  const start = new Date(`${checkInDate}T${checkInTime}:00`);
  const end = new Date(`${checkOutDate}T${checkOutTime}:00`);
  const diffMs = end - start;
  if (diffMs <= 0) return null;
  const totalHours = diffMs / (1000 * 60 * 60);
  return totalHours.toFixed(2);
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────

app.event('app_home_opened', async ({ event, client }) => {
  await client.views.publish({
    user_id: event.user,
    view: {
      type: 'home',
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '👋 Employee Check-In', emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'Track your daily work hours. Click the button below to fill out your daily check-in and check-out.',
          },
        },
        { type: 'divider' },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*📋 Ready to log your day?*\nFill in your check-in time, check-out time, tasks completed, and any notes.',
          },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: '📋 Daily Check-In', emoji: true },
            style: 'primary',
            action_id: 'open_daily_checkin',
          },
        },
        { type: 'divider' },
        {
          type: 'context',
          elements: [
            { type: 'mrkdwn', text: '💡 You can log for a previous day by changing the date pickers.' },
          ],
        },
      ],
    },
  });
});

// ─── Button → Open Modal ──────────────────────────────────────────────────────

app.action('open_daily_checkin', async ({ ack, body, client }) => {
  await ack();
  await openDailyCheckinModal(client, body.trigger_id, body.user.id);
});

// ─── Build & Open Modal ───────────────────────────────────────────────────────

async function openDailyCheckinModal(client, triggerId, userId) {
  await client.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'daily_checkin_submit',
      private_metadata: userId,
      title: { type: 'plain_text', text: 'Daily Check-In', emoji: true },
      submit: { type: 'plain_text', text: 'Submit' },
      close: { type: 'plain_text', text: 'Close' },
      blocks: [

        // ── Check-In ──
        {
          type: 'header',
          text: { type: 'plain_text', text: '🟢 Check-In', emoji: true },
        },
        {
          type: 'input',
          block_id: 'checkin_date',
          label: { type: 'plain_text', text: 'Date' },
          element: {
            type: 'datepicker',
            action_id: 'value',
            initial_date: todayStr(),
            placeholder: { type: 'plain_text', text: 'Select date' },
          },
        },
        {
          type: 'input',
          block_id: 'checkin_time',
          label: { type: 'plain_text', text: 'Time' },
          element: {
            type: 'timepicker',
            action_id: 'value',
            placeholder: { type: 'plain_text', text: 'Select time' },
          },
        },

        { type: 'divider' },

        // ── Check-Out ──
        {
          type: 'header',
          text: { type: 'plain_text', text: '🔴 Check-Out', emoji: true },
        },
        {
          type: 'input',
          block_id: 'checkout_date',
          label: { type: 'plain_text', text: 'Date' },
          element: {
            type: 'datepicker',
            action_id: 'value',
            initial_date: todayStr(),
            placeholder: { type: 'plain_text', text: 'Select date' },
          },
        },
        {
          type: 'input',
          block_id: 'checkout_time',
          label: { type: 'plain_text', text: 'Time' },
          element: {
            type: 'timepicker',
            action_id: 'value',
            placeholder: { type: 'plain_text', text: 'Select time' },
          },
        },

        { type: 'divider' },

        // ── Tasks Completed ──
        {
          type: 'header',
          text: { type: 'plain_text', text: '✅ Tasks Completed', emoji: true },
        },
        {
          type: 'input',
          block_id: 'tasks',
          optional: true,
          label: { type: 'plain_text', text: 'Tasks (one per line)' },
          element: {
            type: 'plain_text_input',
            action_id: 'value',
            multiline: true,
            placeholder: { type: 'plain_text', text: 'e.g.\nReviewed student theory tests\nUpdated class schedule\nOnboarded new student' },
          },
          hint: { type: 'plain_text', text: 'Press Enter after each task to add a new bullet point.' },
        },

        { type: 'divider' },

        // ── Projects Worked On ──
        {
          type: 'header',
          text: { type: 'plain_text', text: '📁 Projects Worked On', emoji: true },
        },
        {
          type: 'input',
          block_id: 'projects',
          optional: true,
          label: { type: 'plain_text', text: 'Projects (one per line)' },
          element: {
            type: 'plain_text_input',
            action_id: 'value',
            multiline: true,
            placeholder: { type: 'plain_text', text: 'e.g.\nStudent onboarding flow\nWebsite updates\nZoom class prep' },
          },
          hint: { type: 'plain_text', text: 'Press Enter after each project to add a new line.' },
        },

        { type: 'divider' },

        // ── Additional Notes ──
        {
          type: 'header',
          text: { type: 'plain_text', text: '📝 Additional Notes', emoji: true },
        },
        {
          type: 'input',
          block_id: 'notes',
          optional: true,
          label: { type: 'plain_text', text: 'Notes' },
          element: {
            type: 'plain_text_input',
            action_id: 'value',
            multiline: true,
            placeholder: { type: 'plain_text', text: 'Any additional context, blockers, or notes for the day...' },
          },
        },

      ],
    },
  });
}

// ─── Modal Submission ─────────────────────────────────────────────────────────

app.view('daily_checkin_submit', async ({ ack, view, client }) => {
  const userId = view.private_metadata;

  const checkinDate  = view.state.values.checkin_date.value.selected_date;
  const checkinTime  = view.state.values.checkin_time.value.selected_time;
  const checkoutDate = view.state.values.checkout_date.value.selected_date;
  const checkoutTime = view.state.values.checkout_time.value.selected_time;
  const tasksRaw     = view.state.values.tasks.value.value || '';
  const projectsRaw  = view.state.values.projects.value.value || '';
  const notes        = view.state.values.notes.value.value || '';

  // Validate check-out is after check-in
  const hours = calcHoursDecimal(checkinDate, checkinTime, checkoutDate, checkoutTime);
  if (!hours) {
    await ack({
      response_action: 'errors',
      errors: {
        checkout_time: 'Check-out must be after check-in time.',
      },
    });
    return;
  }

  await ack();

  // Parse bullet lists
  const taskLines    = tasksRaw.split('\n').map(t => t.trim()).filter(Boolean);
  const projectLines = projectsRaw.split('\n').map(p => p.trim()).filter(Boolean);

  const userInfo = await client.users.info({ user: userId });
  const userName = userInfo.user.real_name || userInfo.user.name;

  const checkinDateLabel  = formatDate(checkinDate);
  const checkoutDateLabel = formatDate(checkoutDate);

  // Build tasks block
  const tasksText = taskLines.length
    ? taskLines.map(t => `• ${t}`).join('\n')
    : '_None provided_';

  // Build projects block
  const projectsText = projectLines.length
    ? projectLines.map(p => `• ${p}`).join('\n')
    : '_None provided_';

  // Post to check-in channel
  await client.chat.postMessage({
    channel: process.env.CHECKIN_CHANNEL_ID,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: `📋 Daily Check-In: ${userName}`, emoji: true },
      },

      // Check-In / Check-Out summary
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*👤 Employee:*\n<@${userId}>` },
          { type: 'mrkdwn', text: `*⏱ Total Hours:*\n${hours} hrs` },
          { type: 'mrkdwn', text: `*🟢 Check-In:*\n${checkinDateLabel} at ${checkinTime}` },
          { type: 'mrkdwn', text: `*🔴 Check-Out:*\n${checkoutDateLabel} at ${checkoutTime}` },
        ],
      },

      { type: 'divider' },

      // Tasks
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*✅ Tasks Completed:*\n${tasksText}` },
      },

      { type: 'divider' },

      // Projects
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*📁 Projects Worked On:*\n${projectsText}` },
      },

      // Notes (only if provided)
      ...(notes ? [
        { type: 'divider' },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*📝 Additional Notes:*\n${notes}` },
        },
      ] : []),

      { type: 'divider' },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Submitted via Employee Check-In App` }],
      },
    ],
    text: `📋 Daily check-in from ${userName} — ${hours} hrs worked`,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

(async () => {
  await app.start();
  console.log('⚡ Employee Check-In App is running!');
})();
