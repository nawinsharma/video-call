import axios from 'axios';

interface PushNotification {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  priority?: 'default' | 'high';
  channelId?: string;
}

export async function sendPushNotification(notification: PushNotification): Promise<boolean> {
  try {
    const { data } = await axios.post<{ data?: { status?: string } }>(
      'https://exp.host/--/api/v2/push/send',
      {
        to: notification.to,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        sound: notification.sound || 'default',
        priority: notification.priority || 'high',
        channelId: notification.channelId || 'calls',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    return data.data?.status === 'ok';
  } catch (error) {
    console.error('Push notification failed:', error);
    return false;
  }
}

export async function sendCallNotification(params: {
  pushToken: string;
  callerName: string;
  callType: 'audio' | 'video';
  callId: string;
}) {
  return sendPushNotification({
    to: params.pushToken,
    title: `Incoming ${params.callType} call`,
    body: `${params.callerName} is calling...`,
    data: {
      type: 'incoming_call',
      callId: params.callId,
      callerName: params.callerName,
      callType: params.callType,
    },
    priority: 'high',
    channelId: 'calls',
  });
}
