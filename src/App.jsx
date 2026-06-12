import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './screens/Home';
import Projects from './screens/Projects';
import Editor from './screens/Editor';
import CaptionEditor from './screens/CaptionEditor';
import ClipsReview from './screens/ClipsReview';
import TransitionClone from './screens/TransitionClone';
import Export from './screens/Export';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen relative z-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/captions" element={<CaptionEditor />} />
          <Route path="/clips" element={<ClipsReview />} />
          <Route path="/transitions" element={<TransitionClone />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
