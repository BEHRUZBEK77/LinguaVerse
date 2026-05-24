const GEMINI_API_KEY = null; // Netlify Function ishlatiladi
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const ALLOWED_ORIGINS = [
    "https://linguaverse-ebe09.web.app",
    "https://linguaverse-ebe09.firebaseapp.com",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
];

export default {
    async fetch(request, env, ctx) {

        if (request.method === "OPTIONS") {
            return handleCORS(request);
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        const origin = request.headers.get("Origin") || "";
        const isAllowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o)) || origin === "";

        if (!isAllowed) {
            return new Response("Forbidden", {
                status: 403,
                headers: corsHeaders(origin)
            });
        }

        try {
            const body = await request.json();

            const geminiRes = await fetch(GEMINI_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            const data = await geminiRes.json();

            return new Response(JSON.stringify(data), {
                status: geminiRes.status,
                headers: {
                    "Content-Type": "application/json",
                    ...corsHeaders(origin)
                }
            });

        } catch (err) {
            return new Response(
                JSON.stringify({ error: { message: "Worker xatosi: " + err.message } }),
                {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                        ...corsHeaders(origin)
                    }
                }
            );
        }
    }
};

function corsHeaders(origin) {
    const allowedOrigin = ALLOWED_ORIGINS.some(o => origin.startsWith(o)) ? origin : ALLOWED_ORIGINS[0];
    return {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
    };
}

function handleCORS(request) {
    const origin = request.headers.get("Origin") || "";
    return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
    });
}