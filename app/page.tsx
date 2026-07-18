"use client";

import {useState} from "react";
import {Canvas} from "@react-three/fiber";
import {OrbitControls,useGLTF} from "@react-three/drei";


function Model(){

const {scene}=useGLTF("/models/demo.glb");

return(
<primitive
object={scene}
scale={1.5}
/>
)

}



export default function Home(){


const [file,setFile]=useState<File|null>(null);

const [image,setImage]=useState("");

const [loading,setLoading]=useState(false);

const [progress,setProgress]=useState(0);

const [done,setDone]=useState(false);



function upload(e:any){

const f=e.target.files[0];

if(!f)return;


setFile(f);

setImage(URL.createObjectURL(f));

}



function startGenerate(){


if(!file)return;


setLoading(true);

setDone(false);

setProgress(0);



let p=0;


const timer=setInterval(()=>{


p+=2;


setProgress(p);



if(p>=100){


clearInterval(timer);


setLoading(false);

setDone(true);


}



},1200);



}




return(


<div className="page">


<h1>
NEXUS 3D
</h1>


<p className="subtitle">
AI Image To 3D Studio
</p>



<div className="workspace">



{/* 左侧上传 */}


<div className="panel">


<h2>
输入图片
</h2>


<label className="upload">


选择图片


<input
type="file"
accept="image/*"
onChange={upload}
/>


</label>



{
image &&
<img
src={image}
className="preview"
/>
}



<button
onClick={startGenerate}
>

开始生成3D模型

</button>



</div>





{/* 中间生成 */}



<div className="panel center">



{

loading &&

<div className="loading">


<div className="scanner">

</div>



<h2>
AI正在重建三维空间
</h2>


<p>
模型拓扑分析：
{progress}%
</p>



<div className="bar">


<div
className="barInner"
style={{
width:`${progress}%`
}}
>


</div>


</div>



<div className="steps">


{

progress<30?
"识别图片结构":

progress<60?
"生成三维网格":

progress<90?
"优化模型纹理":

"完成模型构建"


}


</div>



</div>


}





{

!loading && !done &&

<div className="idle">


等待生成


</div>


}





{

done &&


<div className="modelBox">


<h2>
生成完成
</h2>


<Canvas
camera={{
position:[0,0,3]
}}
>


<ambientLight intensity={2}/>


<directionalLight
position={[3,3,3]}
/>


<Model/>


<OrbitControls/>


</Canvas>


</div>


}



</div>



</div>



</div>



)



}
