import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

console.log("Hello from Edge Functions!");

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { "Content-Type": "application/json" },
      status: 405,
    });
  }

  const supabaseClient = createClient(
    // Supabase API URL - env var SUPABASE_URL
    Deno.env.get("SUPABASE_URL") ?? "https://ivbdbwtacfchvldxvzfq.supabase.co",
    // Supabase API ANON KEY - env var SUPABASE_ANON_KEY
    Deno.env.get("SUPABASE_ANON_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2YmRid3RhY2ZjaHZsZHh2emZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxMDI0MzYsImV4cCI6MjA2MjY3ODQzNn0.u92EHCEa9FtQSxCfcTl1LrZex0XMLvLcOhMbUZkmp74",
    // Create client with Auth context of the user that called the Edge Function
    {
      auth: {
        persistSession: false,
      },
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    }
  );

  try {
    const { profile, checkoutItems, paymentMethod, totalAmount, userId } = await req.json();

    if (!userId || !checkoutItems || checkoutItems.length === 0 || !profile || !profile.full_name || !profile.phone || !profile.address) {
      return new Response(JSON.stringify({ error: 'Missing required data.' }), {
        headers: { "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Start a transaction
    const { data: transactionResult, error: transactionError } = await supabaseClient.rpc('execute_order_transaction', {
        p_user_id: userId,
        p_customer_name: profile.full_name,
        p_customer_email: profile.email || '', // Assuming email is part of profile or user object
        p_customer_phone: profile.phone,
        p_customer_address: profile.address,
        p_payment_method: paymentMethod,
        p_total_amount: totalAmount,
        p_checkout_items: checkoutItems, // Pass the array of items
    });

    if (transactionError) {
        console.error('Transaction error:', transactionError);
        return new Response(JSON.stringify({ error: transactionError.message || 'Failed to execute order transaction.' }), {
            headers: { "Content-Type": "application/json" },
            status: 500,
        });
    }

    // The transaction should return the order_id if successful
    const orderId = transactionResult;

    return new Response(JSON.stringify({ orderId }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
