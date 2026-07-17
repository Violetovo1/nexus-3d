import { NextResponse } from "next/server";

export async function POST(req: Request) {

  try {

    const body = await req.json();

    const imageUrl = body.imageUrl;


    const response = await fetch(
      "https://openapi.tripo3d.ai/v3/generation/image-to-model",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${process.env.TRIPO_API_KEY}`,
        },
        body: JSON.stringify({
          input: imageUrl,
          model: "tripo-v3.1",
          texture: true,
          pbr: true,
          texture_quality: "detailed"
        }),
      }
    );


    const data = await response.json();


    return NextResponse.json(data);


  } catch(error){

    return NextResponse.json(
      {
        error:"生成失败",
        detail:String(error)
      },
      {
        status:500
      }
    );
  }

}
