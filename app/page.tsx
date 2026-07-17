'use client';
import {useState} from 'react';
export default function Home(){const [f,setF]=useState('');return <main style={{minHeight:'100vh',background:'#050816',color:'#fff',padding:40,fontFamily:'Arial'}}><h1>NEXUS 3D</h1><p>AI Image to 3D Studio</p><input type="file" onChange={e=>setF(e.target.files?.[0]?.name||'')}/><h2>{f||'上传图片生成3D模型'}</h2><div style={{height:400,border:'1px solid #334',borderRadius:20,display:'grid',placeItems:'center'}}>3D Viewer</div></main>}
