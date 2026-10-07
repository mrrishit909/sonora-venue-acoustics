"use client";
import dynamic from "next/dynamic";
const App = dynamic(() => import("../src/App"), { ssr: false, loading: () => <div className="boot" role="status">Tuning the hall…</div> });
export default function Page() { return <App />; }
