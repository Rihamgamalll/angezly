// Deploy with Supabase Edge Functions. Invoke from a trusted scheduler using a bearer secret.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (request) => {
  const secret = Deno.env.get('QUEUE_PUSH_CRON_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', {status:401});
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!url || !key || !publicKey || !privateKey || !subject) return new Response('Missing configuration',{status:503});
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const db = createClient(url,key,{auth:{persistSession:false}});
  const {data:events,error} = await db.from('queue_push_outbox').select('id,doctor_id,queue_date,queue_number').is('processed_at',null).order('id').limit(30);
  if (error) return new Response('Database error',{status:500});
  let sent=0;
  for (const event of events ?? []) {
    const {data:queue,error:queueError} = await db.from('clinic_queue').select('appointment_id,queue_number,status').eq('doctor_id',event.doctor_id).eq('queue_date',event.queue_date).gt('queue_number',event.queue_number).in('status',['waiting','in_progress']);
    if(queueError) continue;
    for (const item of queue ?? []) {
      const {data:subscriptions,error:subError}=await db.from('queue_push_subscriptions').select('id,endpoint,p256dh,auth_secret').eq('appointment_id',item.appointment_id);
      if(subError) continue;
      for(const sub of subscriptions ?? []) {
        const ahead=(queue ?? []).filter(q=>q.queue_number<item.queue_number).length;
        try {
          await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_secret}},JSON.stringify({title:'أنجزلي · دورك قرب',body:ahead===0?'دورك قرب جدًا، تابع العيادة.':`فاضلك ${ahead} مريض قبلك.`,url:'/'}));
          sent++;
        } catch(e) {
          const code=(e as {statusCode?:number}).statusCode;
          if(code===404 || code===410) await db.from('queue_push_subscriptions').delete().eq('id',sub.id);
        }
      }
    }
    await db.from('queue_push_outbox').update({processed_at:new Date().toISOString()}).eq('id',event.id).is('processed_at',null);
  }
  return Response.json({events:events?.length??0,sent});
});
