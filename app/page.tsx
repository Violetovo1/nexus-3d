"use client";

import {useState,useEffect} from "react";
import {Canvas} from "@react-three/fiber";
import {OrbitControls,useGLTF} from "@react-three/drei";


function Model(){

 const {scene}=useGLTF("/models/demo.glb");

 return (
   <primitive 
    object={scene}
    scale={1.5}
   />
 )

}



export default function Home(){

const [file,setFile]=useState<File|null>(null);

const [loading,setLoading]=useState(false);

const [progress,setProgress]=useState(0);

const [done,setDone]=useState(false);



function startGenerate(){

 if(!file)return;

 setLoading(true);
 setDone(false);
 setProgress(0);

}



useEffect(()=>{

 if(!loading)return;


 const timer=setInterval(()=>{

  setProgress(p=>{

   if(p>=100){

    clearInterval(timer);

    setTimeout(()=>{

     setLoading(false);
     setDone(true);

    },500)

    return 100;

   }

   return p+1;

  })


 },600);


return ()=>clearInterval(timer);


},[loading]);





return (

<div className="page">


<h1>
NEXUS 3D
</h1>


<p className="sub">
AI Image To 3D Studio
</p>



<div className="upload">


<input

type="file"

accept="image/*"

onChange={(e)=>{

if(e.target.files)

setFile(e.target.files[0])

}}

/>



<button

onClick={startGenerate}

>

开始生成3D模型

</button>


</div>




{
loading &&

<div className="ai-box">


<h2>
AI正在生成3D模型
</h2>



<div className="scan"></div>



<h3>
{
progress<20?
"正在分析图片结构":

progress<40?
"正在提取空间信息":

progress<60?
"正在生成三维点云":

progress<80?
"正在重建Mesh模型":

"正在进行材质贴图"
}

</h3>




<div className="bar">

<div

style={{

width:`${progress}%`

}}

/>

</div>


<p>
{progress}%
</p>


</div>

}





{
done &&

<div className="viewer">


<h2>
AI生成完成
</h2>


<Canvas>


<ambientLight intensity={2}/>

<directionalLight position={[3,3,3]}/>


<Model/>


<OrbitControls/>


</Canvas>


</div>

}




</div>

)

}
