import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl = process.env.BACKEND_URL;
    const backendUrl = `${baseUrl}/api/tokens`;
    const apiKey = process.env.ADMIN_API_KEY!;

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        "x-admin-key": apiKey,
      },
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
