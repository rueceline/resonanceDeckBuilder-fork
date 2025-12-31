import fs from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"

// fs 사용하므로 Node 런타임 고정
export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    path: string[]
  }>
}

export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    // ✅ params는 반드시 await
    const { path: segments } = await context.params

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      )
    }

    const filePath = segments.join("/")
    const fullPath = path.join(process.cwd(), "public", "db", filePath)

    const data = await fs.readFile(fullPath)

    return new NextResponse(data)
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Not found",
        detail: err?.message ?? String(err),
      },
      { status: 404 }
    )
  }
}
