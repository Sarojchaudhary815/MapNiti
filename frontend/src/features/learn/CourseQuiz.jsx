import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle2, XCircle, Loader2, RotateCcw, ArrowRight, Lock } from 'lucide-react';
import { getCourseQuiz, submitCourseQuiz, setLessonProgress } from '../../api/hubApi';

/**
 * Final quiz at the end of a course. Graded on the server; passing it after
 * finishing every lesson issues a certificate with a public verify code.
 */
export default function CourseQuiz({ course, isDone, loggedIn }) {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const doneHere = course.lessons.filter((l) => isDone(course.id, l.id));
  const allDone = doneHere.length === course.lessons.length;

  const load = React.useCallback(() => {
    setErr('');
    getCourseQuiz(course.id).then(setQuiz).catch(() => setErr('Could not load the quiz. Check your connection.'));
  }, [course.id]);
  useEffect(() => { if (loggedIn) load(); }, [loggedIn, load]);

  const submit = async () => {
    setBusy(true);
    setErr('');
    try {
      // lessons ticked before logging in live only in this browser: send them first
      await Promise.all(doneHere.map((l) => setLessonProgress(course.id, l.id, true).catch(() => {})));
      const res = await submitCourseQuiz(course.id, quiz.questions.map((q) => answers[q.i] || ''));
      setResult(res);
      if (res.certificate) setQuiz((q) => ({ ...q, certificate: res.certificate }));
    } catch (e) {
      setErr(e.response?.data?.detail || 'Could not submit. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const retry = async () => {
    setResult(null);
    setAnswers({});
    setQuiz(await getCourseQuiz(course.id));   // fresh option order
  };

  const shell = (children) => (
    <section id="final-quiz" className="mt-8 bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
      <div className="px-6 md:px-10 py-5 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-white flex items-center gap-3">
        <span className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><Award size={20} /></span>
        <div>
          <p className="font-display text-lg font-semibold text-slate-900">Final quiz &amp; certificate</p>
          <p className="text-[12.5px] text-slate-500">Finish every lesson, then score 70% or more to earn a certificate you can share and verify.</p>
        </div>
      </div>
      <div className="px-6 md:px-10 py-6">{children}</div>
    </section>
  );

  if (!loggedIn) {
    return shell(
      <p className="text-[14px] text-slate-600 flex items-center gap-2">
        <Lock size={15} className="text-slate-400" />
        <span><Link to="/login" className="font-semibold text-theme-700 underline">Log in</Link> to take the quiz and get your certificate. It is free.</span>
      </p>,
    );
  }
  if (!quiz) {
    return shell(err
      ? <p className="text-[13.5px] text-red-600">{err} <button onClick={load} className="ml-2 font-semibold underline">Retry</button></p>
      : <Loader2 size={18} className="animate-spin text-slate-400" />);
  }

  const cert = quiz.certificate;
  const certBox = cert && (
    <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex flex-wrap items-center gap-3 justify-between">
      <p className="text-[14px] text-emerald-800 flex items-center gap-2">
        <CheckCircle2 size={18} /> Certificate earned · score {cert.score}% · code <span className="font-mono font-bold">{cert.code}</span>
      </p>
      <Link to={`/certificate/${cert.code}`} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold px-4 py-2 flex items-center gap-1.5">
        View &amp; share <ArrowRight size={14} />
      </Link>
    </div>
  );

  if (result) {
    return shell(
      <>
        {certBox}
        <div className={`rounded-2xl p-4 mb-5 ${result.passed ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          <p className="font-display text-2xl font-semibold">{result.score}%</p>
          <p className="text-[13.5px] mt-0.5">
            {result.correct} of {result.total} correct.{' '}
            {result.passed
              ? (result.certificate ? 'Well done — you passed!' : `You passed, but finish all lessons first (${result.lessons_done} of ${result.lessons_required} done), then submit again for the certificate.`)
              : 'You need 70% to pass. Review the answers below and try again.'}
          </p>
        </div>
        <ol className="space-y-3">
          {result.review.map((r, i) => (
            <li key={i} className={`rounded-xl border p-4 ${r.correct ? 'border-emerald-200' : 'border-red-200 bg-red-50/30'}`}>
              <p className="text-[14px] font-semibold text-slate-800 flex gap-2">
                {r.correct ? <CheckCircle2 size={17} className="text-emerald-600 shrink-0 mt-0.5" /> : <XCircle size={17} className="text-red-500 shrink-0 mt-0.5" />}
                {r.question}
              </p>
              {!r.correct && <p className="text-[13px] text-slate-600 mt-1.5 ml-6">Your answer: {r.chosen || '—'} · Correct: <b>{r.answer}</b></p>}
              <p className="text-[12.5px] text-slate-500 mt-1 ml-6">{r.explanation}</p>
            </li>
          ))}
        </ol>
        <button onClick={retry} className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5">
          <RotateCcw size={14} /> {result.passed ? 'Take it again' : 'Try again'}
        </button>
      </>,
    );
  }

  const answered = quiz.questions.filter((q) => answers[q.i]).length;
  return shell(
    <>
      {certBox}
      {!allDone && !cert && (
        <p className="mb-5 text-[13px] text-amber-700 bg-amber-50 rounded-xl px-4 py-2.5">
          {doneHere.length} of {course.lessons.length} lessons done. You can try the quiz now, but the certificate is issued only when every lesson is complete.
        </p>
      )}
      <ol className="space-y-5">
        {quiz.questions.map((q, n) => (
          <li key={q.i}>
            <p className="text-[14.5px] font-semibold text-slate-800"><span className="font-mono text-[12px] text-pop-600 mr-2">{String(n + 1).padStart(2, '0')}</span>{q.question}</p>
            <div className="mt-2 grid sm:grid-cols-2 gap-2">
              {q.options.map((o) => {
                const on = answers[q.i] === o;
                return (
                  <label key={o} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer text-[13.5px] transition
                    ${on ? 'border-theme-500 bg-theme-50 text-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                    <input type="radio" name={`q${q.i}`} className="mt-1 accent-current" checked={on} onChange={() => setAnswers((a) => ({ ...a, [q.i]: o }))} />
                    <span>{o}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      {err && <p className="mt-4 text-[13px] text-red-600">{String(err)}</p>}
      <button onClick={submit} disabled={busy || answered < quiz.questions.length}
        className="mt-6 rounded-xl bg-pop-500 hover:bg-pop-600 disabled:opacity-40 text-white text-[14px] font-semibold px-5 py-2.5 flex items-center gap-2">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Award size={16} />} Submit answers ({answered}/{quiz.questions.length})
      </button>
    </>,
  );
}
