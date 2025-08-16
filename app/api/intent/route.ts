import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // console.log('Request ', request.nextUrl)
    const { authToken, prompt } = await request.json();
    if (!authToken) {
      return NextResponse.json(
        { error: "No auth token provided" },
        { status: 400 },
      );
    }

    // Forward request to backend
    const baseUrl = process.env.BACKEND_URL;
    const backendUrl = `${baseUrl}/api/intent`;
    const apiKey = process.env.ADMIN_API_KEY!;

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": apiKey,
      },
      body: JSON.stringify({
        authToken,
        prompt,
      }),
    });

    const data = await response.json();
    if (response.ok) {
      return NextResponse.json(data);
    } else {
      return NextResponse.json(
        { error: data.error || "Failed to save user" },
        { status: response.status },
      );
    }
  } catch (error) {
    console.error("Error in save-user API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
