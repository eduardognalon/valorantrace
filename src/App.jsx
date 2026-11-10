import { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Award, BarChart3, ChevronRight, CircleHelp, Crosshair, Flag, Gamepad2, LayoutDashboard, Medal, Plus, Shield, SlidersHorizontal, Sparkles, Target, Trophy, Users, X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CATEGORIES, loadData } from './data';

const fmt = n => new Intl.NumberFormat('pt-BR').format(n);
const dateLabel = d => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

export default function App() {
  const [data, setData] = useState(loadData);
  const [page, setPage] = useState('overview');
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const [adminPlayerId, setAdminPlayerId] = useState('ana');
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);

  useEffect(() => {
    const sync = () => fetch('/api/data').then(response => response.ok ? response.json() : null).then(remote => {
      if (!remote) return;
      setData(current => {
        const next = { ...current, ...remote };
        localStorage.setItem('valorant-race-v1', JSON.stringify(next));
        return next;
      });
    }).catch(() => {});
    sync();
    const timer = window.setInterval(sync, 30000);
    fetch('/api/auth/me').then(response => response.json()).then(result => setAdminAuthenticated(result.authenticated)).catch(() => {});
    return () => window.clearInterval(timer);
  }, []);

  function update(next) {
    setData(next);
    localStorage.setItem('valorant-race-v1', JSON.stringify(next));
  }

  const players = useMemo(() => data.players.map(p => {
    const own = data.evaluations.filter(e => e.playerId === p.id);
    return { ...p, score: own.reduce((s, e) => s + e.total, 0), days: own.length, last: own.at(-1)?.date };
  }).sort((a, b) => b.score - a.score), [data]);
  const totalEvaluations = data.evaluations.length;

  async function saveObjectives(playerId, objectives) {
    const response = await fetch(`/api/objectives/${playerId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objectives }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível salvar os objetivos.');
    update(result);
  }

  async function loginAdmin(password) {
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Não foi possível entrar.');
    setAdminAuthenticated(true);
  }

  async function logoutAdmin() { await fetch('/api/auth/logout', { method: 'POST' }); setAdminAuthenticated(false); }

  function openEvaluation() {
    if (!adminAuthenticated) { setPage('admin'); return; }
    setModal(true);
  }

  function openObjectiveManager(playerId = 'ana') { setAdminPlayerId(playerId); setPage('admin'); setSelected(null); }
  const top = players[0];
  const nextGoal = data.goals.find(g => g.points > (top?.score || 0));
  const maxPoints = Math.max(1000, ...players.map(p => p.score), ...data.goals.map(g => g.points));
  const bars = players.map((p, i) => ({ ...p, position: i + 1 }));

  async function saveEvaluation(e) {
    e.preventDefault();
    const items = data.players.map(player => {
      const notes = CATEGORIES.map((_, i) => ({ score: Number(form[`${player.id}_n${i}`] || 0), feedback: form[`${player.id}_f${i}`] || '' }));
      return { id: crypto.randomUUID(), playerId: player.id, objectives: [...(data.objectives[player.id] || [])], date: form.date || new Date().toISOString().slice(0, 10), total: notes.reduce((sum, n) => sum + n.score, 0), notes, feedback: form[`${player.id}_feedback`] || '' };
    });
    try {
      const response = await fetch('/api/evaluations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evaluations: items }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar as avaliações.');
      update(result); setModal(false); setForm({});
    } catch (error) { window.alert(error.message); }
  }

  function redeem(goalId, playerId) {
    const goal = data.goals.find(g => g.id === goalId);
    update({ ...data, redeemed: [...data.redeemed, { goalId, playerId, date: new Date().toISOString() }] });
  }

  const earned = goal => data.redeemed.filter(r => r.goalId === goal.id);

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top" onClick={() => setPage('overview')}><span className="brand-mark"><Crosshair size={20}/></span><span>VALORANT <b>RACE</b><small>SEASON 01 · EVOLUÇÃO</small></span></a>
      <div className="nav-label">COMPETIÇÃO</div>
      <button className={`nav-item ${page === 'overview' ? 'active' : ''}`} onClick={() => { setPage('overview'); setSelected(null); }}><LayoutDashboard size={18}/> Painel geral</button>
      <button className={`nav-item ${page === 'players' ? 'active' : ''}`} onClick={() => { setPage('players'); setSelected(null); }}><Users size={18}/> Jogadores <span className="nav-count">04</span></button>
      <button className="nav-item" onClick={openEvaluation}><BarChart3 size={18}/> Avaliações</button>
      <div className="nav-label nav-label-gap">GERENCIAMENTO</div>
      <button className={`nav-item ${page === 'admin' ? 'active' : ''}`} onClick={() => openObjectiveManager()}><Shield size={18}/> Administração</button>
      <div className="sidebar-bottom"><div className="season-card"><div className="season-icon"><Flag size={16}/></div><div><b>Temporada 01</b><small>Em andamento</small></div><span className="live-dot"/></div><div className="admin-row"><div className="admin-avatar">AD</div><div><b>Organizador</b><small>Administrador</small></div><SlidersHorizontal size={16} className="muted-icon"/></div></div>
    </aside>

    <main id="top" className="main-content">
      <header className="topbar"><div className="mobile-brand"><Crosshair size={19}/> VALORANT <b>RACE</b></div><div className="breadcrumb">Temporada 01 <ChevronRight size={14}/> <strong>{selected ? selected.name : page === 'players' ? 'Jogadores' : 'Painel geral'}</strong></div><div className="top-actions"><span className="status-pill"><i/> Temporada ativa</span><button className="icon-button" title="Ajuda"><CircleHelp size={18}/></button><div className="top-avatar">AD</div></div></header>

      {selected ? <PlayerDetail player={selected} data={data} playerStats={players.find(p => p.id === selected.id)} onBack={() => setSelected(null)} onEvaluate={openEvaluation} onManage={() => openObjectiveManager(selected.id)} /> : page === 'admin' ? <AdminScreen data={data} initialPlayerId={adminPlayerId} onSave={saveObjectives} authenticated={adminAuthenticated} onLogin={loginAdmin} onLogout={logoutAdmin} onAddEvaluation={openEvaluation} /> : page === 'players' ? <section className="page-wrap"><PageHeading eyebrow="ELENCO DA TEMPORADA" title="Jogadores" subtitle="Acompanhe o desempenho e os objetivos individuais da equipe." action={<button className="button primary" onClick={openEvaluation}><Plus size={16}/> Adicionar avaliação</button>} /><div className="player-grid">{players.map((p, i) => <PlayerCard key={p.id} p={p} index={i} objectives={data.objectives[p.id] || []} onClick={() => setSelected(p)}/>)}</div></section> : <section className="page-wrap">
        <PageHeading eyebrow="SEASON 01 · CORRIDA PELA EVOLUÇÃO" title={<>Cada round conta<span className="title-period">.</span></>} subtitle="Uma corrida para evoluir. Acompanhe o progresso de cada jogador e descubra quem está mais perto do próximo marco." action={<button className="button primary" onClick={() => setModal(true)}><Plus size={16}/> Adicionar avaliação</button>} />
        <div className="stats-grid">
          <StatCard label="LÍDER ATUAL" value={top?.name || '—'} detail={`${fmt(top?.score || 0)} pontos acumulados`} icon={<Trophy size={17}/>} accent="red" extra={top?.days ? <span className="trend"><ArrowUpRight size={14}/> na liderança</span> : <span className="subtle">Aguardando avaliações</span>}/>
          <StatCard label="PONTOS EM DISPUTA" value={fmt(players.reduce((s, p) => s + p.score, 0))} detail="somados por todo o time" icon={<Target size={17}/>} accent="blue" extra={<span className="stat-mini">{totalEvaluations} avaliações</span>}/>
          <StatCard label="PRÓXIMO MARCO" value={nextGoal ? fmt(nextGoal.points) : 'Completo'} detail={nextGoal ? nextGoal.reward : 'Todos os marcos alcançados'} icon={<Flag size={17}/>} accent="gold" extra={nextGoal && <span className="trend gold-text"><ArrowDownRight size={14}/>{fmt(Math.max(0, nextGoal.points - (top?.score || 0)))} pts para o líder</span>}/>
          <StatCard label="DIAS AVALIADOS" value={fmt(totalEvaluations)} detail="registros no histórico" icon={<Activity size={17}/>} accent="purple" extra={<span className="subtle">{new Set(data.evaluations.map(e => e.date)).size} dias de jogo</span>}/>
        </div>

        <div className="content-grid">
          <section className="panel race-panel"><div className="panel-heading"><div><div className="eyebrow">PLACAR DA TEMPORADA</div><h2>Corrida dos jogadores</h2><p>Pontuação acumulada · primeiro até o próximo marco</p></div><div className="season-tag"><span className="live-dot"/> AO VIVO</div></div>
            <div className="chart-wrap">{players.length ? <ResponsiveContainer width="100%" height={270}><BarChart data={bars} layout="vertical" margin={{ top: 8, right: 14, bottom: 8, left: -8 }} barCategoryGap={22}><CartesianGrid horizontal={false} stroke="#27303d"/><XAxis type="number" domain={[0, maxPoints]} tickLine={false} axisLine={false} tick={{ fill: '#788391', fontSize: 11 }} tickFormatter={fmt}/><YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={64} tick={<CustomAxis/>}/><Tooltip cursor={{ fill: 'rgba(255,255,255,.025)' }} content={<ChartTooltip/>}/><Bar dataKey="score" radius={[0, 5, 5, 0]} maxBarSize={25} background={{ fill: '#171f2a', radius: 5 }}>{bars.map(p => <Cell key={p.id} fill={p.color}/>)}</Bar></BarChart></ResponsiveContainer> : null}
              <div className="milestone-track">{data.goals.map(g => <div key={g.id} className="track-marker" style={{ left: `${Math.min(98, g.points / maxPoints * 100)}%` }}><span className={`marker-line ${earned(g).length ? 'reached' : ''}`}/><span className="marker-label">{g.points}</span></div>)}</div>
            </div><div className="chart-legend"><span><i className="legend-dot red"/> Líder</span><span><i className="legend-dot gray"/> Jogadores</span><span><i className="legend-dash"/> Marcos de recompensa</span></div>
          </section>
          <section className="panel goals-panel"><div className="panel-heading"><div><div className="eyebrow">RECOMPENSAS</div><h2>Marcos da corrida</h2></div><span className="goals-count">{data.goals.length} marcos</span></div><div className="goal-list">{data.goals.map((g, i) => { const won = earned(g); return <div key={g.id} className={`goal-row ${won.length ? 'goal-won' : ''}`}><div className={`goal-icon ${g.kind}`}><Award size={17}/></div><div className="goal-info"><div className="goal-title-line"><b>{g.reward}</b><span className={`goal-type ${g.kind}`}>{g.kind === 'shared' ? 'COMPARTILHADA' : 'EXCLUSIVA'}</span></div><small>{g.points} pontos · {g.kind === 'shared' ? 'todos podem conquistar' : 'primeiro a alcançar'}</small>{won.length > 0 && <div className="winner-line"><Medal size={12}/>{won.map(w => data.players.find(p => p.id === w.playerId)?.name).join(', ')} · conquistada</div>}</div><div className={`goal-state ${won.length ? 'done' : ''}`}>{won.length ? '✓' : String(i + 1).padStart(2, '0')}</div></div>; })}</div></section>
        </div>

        <section className="panel roster-panel"><div className="panel-heading roster-heading"><div><div className="eyebrow">CLASSIFICAÇÃO</div><h2>Ranking da temporada</h2><p>Desempenho acumulado de cada participante</p></div><button className="text-button" onClick={() => setPage('players')}>Ver jogadores <ChevronRight size={15}/></button></div><div className="ranking-table"><div className="table-head"><span>POS.</span><span>JOGADOR</span><span>PATENTE</span><span>PROGRESSO</span><span>PONTOS</span><span>DIAS</span></div>{players.map((p, i) => <div className="table-row" key={p.id}><span className={`rank-number ${i === 0 ? 'first' : ''}`}>{String(i + 1).padStart(2, '0')}{i === 0 && <span className="rank-crown">♛</span>}</span><span className="player-cell"><i className="player-dot" style={{ background: p.color }}/><b>{p.name}</b></span><span className="rank-cell">{p.rank}</span><span className="progress-cell"><span className="progress-track"><i style={{ width: `${Math.min(100, p.score / 1000 * 100)}%`, background: p.color }}/></span><small>{fmt(p.score)} / 1.000</small></span><span className="points-cell" style={{ color: p.color }}>{fmt(p.score)} <small>PTS</small></span><span className="days-cell">{p.days || '—'}</span></div>)}</div></section>
        <footer className="page-footer"><span><Gamepad2 size={14}/> Evolução acima do placar.</span><span>VALORANT RACE <b>·</b> Temporada 01</span></footer>
      </section>}
    </main>
    {modal && <EvaluationModal data={data} form={form} setForm={setForm} onClose={() => { setModal(false); setForm({}); }} onSave={saveEvaluation}/>}
  </div>;
}

function PageHeading({ eyebrow, title, subtitle, action }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>; }
function StatCard({ label, value, detail, icon, accent, extra }) { return <div className={`stat-card ${accent}`}><div className="stat-top"><span>{label}</span><i>{icon}</i></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div><div className="stat-extra">{extra}</div></div>; }
function CustomAxis({ x, y, payload }) { return <g transform={`translate(${x},${y})`}><text x={0} y={0} dy={4} textAnchor="start" fill="#cbd2dc" fontSize={12} fontWeight={600}>{payload.value}</text></g>; }
function ChartTooltip({ active, payload }) { if (!active || !payload?.length) return null; const p = payload[0].payload; return <div className="chart-tooltip"><b style={{ color: p.color }}>{p.name}</b><strong>{fmt(p.score)} <small>PTS</small></strong></div>; }
function PlayerCard({ p, index, objectives, onClick }) { return <button className="player-card" onClick={onClick}><div className="player-card-top"><div className="player-avatar" style={{ '--player-color': p.color }}>{p.avatar}</div><div className="player-card-rank">#{String(index + 1).padStart(2, '0')}</div></div><h3>{p.name}</h3><div className="player-rank-label">{p.rank}</div><div className="player-card-score"><b style={{ color: p.color }}>{fmt(p.score)}</b><small>PTS</small><span>{p.days} dias</span></div><div className="mini-progress"><i style={{ width: `${Math.min(100, p.score / 1000 * 100)}%`, background: p.color }}/></div><div className="objective-peek"><span>OBJETIVOS ATIVOS</span><b>{objectives.length || 0} objetivos</b></div><div className="card-link">Ver análise individual <ChevronRight size={15}/></div></button>; }
function EvaluationHistoryRow({ evaluation, player }) { return <div className="history-row"><div><b>{dateLabel(evaluation.date)}</b><small>{evaluation.feedback || 'Sem feedback geral'}</small>{evaluation.objectives?.length > 0 && <details className="history-goals"><summary>Ver objetivos avaliados</summary>{evaluation.objectives.map((objective, i) => <div key={i}><span>{objective}</span><b>{evaluation.notes?.[i]?.score ?? '—'} / 10</b></div>)}</details>}</div><strong style={{ color: player.color }}>{evaluation.total}<small> / 50</small></strong></div>; }
function AdminScreen({ data, initialPlayerId, onSave, authenticated, onLogin, onLogout, onAddEvaluation }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); setError(''); try { await onLogin(password); setPassword(''); } catch (err) { setError(err.message); } }
  if (!authenticated) return <section className="page-wrap"><PageHeading eyebrow="ÁREA RESTRITA" title="Administração" subtitle="Entre com a senha administrativa para editar os objetivos."/><form className="admin-login panel" onSubmit={submit}><div className="login-icon"><Shield size={20}/></div><h2>Acesso do organizador</h2><p>A autenticação é verificada pelo servidor.</p><label>Senha administrativa<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required/></label>{error && <div className="login-error">{error}</div>}<button className="button primary" type="submit">Entrar na administração</button></form></section>;
  return <AdminObjectives data={data} initialPlayerId={initialPlayerId} onSave={onSave} onLogout={onLogout} onAddEvaluation={onAddEvaluation}/>;
}
function AdminObjectives({ data, initialPlayerId, onSave, onLogout, onAddEvaluation }) {
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const [draft, setDraft] = useState(() => [...(data.objectives[initialPlayerId] || [])]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const player = data.players.find(p => p.id === playerId);
  const history = data.objectiveHistory?.[playerId] || [];
  function selectPlayer(id) { setPlayerId(id); setDraft([...(data.objectives[id] || [])]); setSaved(false); }
  function changeGoal(index, value) { setDraft(current => current.map((goal, i) => i === index ? value : goal)); setSaved(false); setError(''); }
  async function save() { setError(''); try { await onSave(playerId, draft.map(goal => goal.trim())); setSaved(true); } catch (err) { setError(err.message); } }
  return <section className="page-wrap"><div className="admin-page-heading"><PageHeading eyebrow="ÁREA DE ADMINISTRAÇÃO" title="Gerenciar objetivos" subtitle="Edite os cinco objetivos ativos de cada participante. As alterações são validadas e salvas no servidor."/><div className="admin-heading-buttons"><button className="button primary" onClick={onAddEvaluation}><Plus size={15}/> Nova avaliação</button><button className="button ghost" onClick={onLogout}>Sair</button></div></div><div className="admin-layout"><div className="panel objective-editor"><div className="player-select-row">{data.players.map(p => <button className={`select-player ${playerId === p.id ? 'selected' : ''}`} key={p.id} onClick={() => selectPlayer(p.id)}><i style={{ background: p.color }}/>{p.name}<small>{p.rank}</small></button>)}</div><div className="editor-title"><div className="player-avatar small" style={{ '--player-color': player.color }}>{player.avatar}</div><div><h2>{player.name}</h2><small>{player.rank} · cinco objetivos ativos</small></div></div><div className="objective-fields">{draft.map((goal, i) => <label className="objective-field" key={i}><span>{String(i + 1).padStart(2, '0')}</span><input value={goal} maxLength={140} onChange={e => changeGoal(i, e.target.value)} placeholder={`Objetivo ${i + 1}`}/><small>{goal.length}/140</small></label>)}</div><div className="editor-footer"><span>Ao substituir um objetivo, o histórico anterior será preservado.</span><button className="button primary" disabled={draft.length !== 5 || draft.some(goal => !goal.trim())} onClick={save}><Shield size={15}/> Salvar objetivos</button></div>{error && <div className="login-error">{error}</div>}{saved && <div className="save-confirmation">✓ Objetivos de {player.name} atualizados no servidor.</div>}</div><aside className="panel objective-history"><div className="eyebrow">HISTÓRICO</div><h2>Objetivos substituídos</h2><p>As avaliações já feitas continuam ligadas ao conjunto de objetivos usado naquele dia.</p>{history.length ? history.slice().reverse().map((item, i) => <div className="archived-goal" key={`${item.changedAt}-${i}`}><span>{item.status}</span><b>{item.description}</b><small>{new Date(item.changedAt).toLocaleDateString('pt-BR')}</small></div>) : <div className="empty-archive">Nenhum objetivo substituído ainda.</div>}<div className="admin-local-note"><Shield size={14}/> Somente uma sessão administrativa autenticada pode gravar alterações.</div></aside></div></section>;
}
function PlayerDetail({ player, data, playerStats, onBack, onEvaluate, onManage }) { const history = data.evaluations.filter(e => e.playerId === player.id).slice().reverse(); return <section className="page-wrap"><button className="back-link" onClick={onBack}>← Voltar para jogadores</button><PageHeading eyebrow="ANÁLISE INDIVIDUAL" title={player.name} subtitle={`${player.rank} · ${fmt(playerStats?.score || 0)} pontos acumulados`} action={<div className="heading-actions"><button className="button ghost" onClick={onManage}><SlidersHorizontal size={15}/> Gerenciar objetivos</button><button className="button primary" onClick={onEvaluate}><Plus size={16}/> Avaliar jogador</button></div>}/><div className="detail-grid"><div className="panel detail-objectives"><div className="eyebrow">FOCO ATUAL</div><h2>Objetivos individuais</h2>{(data.objectives[player.id] || []).map((o, i) => <div className="objective-row" key={i}><span>{String(i + 1).padStart(2, '0')}</span><b>{o}</b><Target size={15}/></div>)}</div><div className="panel detail-history"><div className="eyebrow">REGISTROS</div><h2>Histórico de avaliações</h2>{history.length ? history.map(e => <EvaluationHistoryRow key={e.id} evaluation={e} player={player}/>) : <div className="empty-state"><Sparkles size={20}/>Ainda não há avaliações para este jogador.</div>}</div></div></section>; }
function EvaluationModal({ data, form, setForm, onClose, onSave }) {
  const [step, setStep] = useState(0);
  const isSummary = step >= data.players.length;
  const player = data.players[Math.min(step, data.players.length - 1)];
  const goals = data.objectives[player.id] || [];
  const playerTotal = id => CATEGORIES.reduce((sum, _, i) => sum + Number(form[`${id}_n${i}`] || 0), 0);
  const setValue = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><div className="modal">
    <div className="modal-head"><div><div className="eyebrow">ADMINISTRAÇÃO · NOVO REGISTRO</div><h2>{isSummary ? 'Revisar avaliações' : 'Adicionar avaliação'}</h2><p>{isSummary ? 'Confira o resumo antes de salvar as avaliações.' : 'Avalie os objetivos atuais de cada jogador.'}</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></div>
    <form onSubmit={onSave}>
      <div className="step-tabs">{data.players.map((p, i) => <button type="button" key={p.id} onClick={() => setStep(i)} className={step === i ? 'current' : ''}><span>{i + 1}</span>{p.name}</button>)}<button type="button" onClick={() => setStep(data.players.length)} className={isSummary ? 'current' : ''}><span>✓</span>Resumo</button></div>
      {!isSummary ? <><div className="eval-player"><div className="player-avatar small" style={{ '--player-color': player.color }}>{player.avatar}</div><div><b>{player.name}</b><small>{player.rank} · {goals.length} objetivos ativos</small></div><label>Data<input type="date" value={form.date || new Date().toISOString().slice(0, 10)} onChange={e => setValue('date', e.target.value)}/></label></div>
        <div className="eval-goals">{goals.map((goal, i) => <div className="eval-goal" key={i}><div className="eval-goal-name"><span>{String(i + 1).padStart(2, '0')}</span><b>{goal}</b></div><div className="eval-inputs"><label>Nota <input type="number" min="0" max="10" required placeholder="0–10" value={form[`${player.id}_n${i}`] ?? ''} onChange={e => setValue(`${player.id}_n${i}`, e.target.value)}/></label><label>Feedback do objetivo <input placeholder="Comentário breve (opcional)" value={form[`${player.id}_f${i}`] || ''} onChange={e => setValue(`${player.id}_f${i}`, e.target.value)}/></label></div></div>)}</div>
        <label className="general-feedback">Feedback geral<textarea rows="2" placeholder="Observações para este jogador..." value={form[`${player.id}_feedback`] || ''} onChange={e => setValue(`${player.id}_feedback`, e.target.value)}/></label>
      </> : <div className="review-list">{data.players.map(p => <div className="review-row" key={p.id}><span className="player-dot" style={{ background: p.color }}/><b>{p.name}</b><small>{p.rank}</small><strong>{playerTotal(p.id)} / 50</strong></div>)}</div>}
      <div className="modal-footer"><span>{isSummary ? <>Data <b>{form.date || new Date().toLocaleDateString('pt-BR')}</b></> : <>Nota total <b>{playerTotal(player.id)} / 50</b></>}</span><div>{step > 0 && <button type="button" className="button ghost" onClick={() => setStep(step - 1)}>Anterior</button>}{!isSummary ? <button type="button" className="button primary" onClick={() => setStep(step + 1)}>{step === data.players.length - 1 ? 'Revisar resumo' : 'Próximo jogador'} <ChevronRight size={15}/></button> : <button type="submit" className="button primary">Confirmar e salvar</button>}</div></div>
    </form></div></div>;
}

