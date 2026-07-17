"use client";

import { useState } from "react";

export default function Home() {

  const [file,setFile] = useState<File | null>(null);
  const [status,setStatus] = useState("");
  const [model,setModel] = useState("");


  async function generate(){

    if(!file){
      alert("请先上传图片");
      return;
    }


    setStatus("正在上传图片...");


    // 临时使用图片地址
    const imageUrl = URL.createObjectURL(file);


    setStatus("正在调用 Tripo AI 生成3D模型...");


    const res = await fetch("/api/generate",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        imageUrl
      })
    });


    const data = await res.json();


    console.log(data);


    if(data){
      setStatus("生成任务已提交");
      setModel(JSON.stringify(data,null,2));
    }


  }


  return (
    <main
      style={{
        minHeight:"100vh",
        background:"#050816",
        color:"white",
        padding:"50px"
      }}
    >

      <h1>
        NEXUS 3D
      </h1>


      <p>
        AI Image to 3D Studio
      </p>


      <input
        type="file"
        accept="image/*"
        onChange={(e)=>
          setFile(
            e.target.files?.[0] || null
          )
        }
      />


      <br/><br/>


      <button
        onClick={generate}
        style={{
          padding:"15px 30px",
          borderRadius:"10px",
          cursor:"pointer"
        }}
      >
        开始生成3D模型
      </button>


      <h3>
        {status}
      </h3>


      <pre>
        {model}
      </pre>


    </main>
  );
}
