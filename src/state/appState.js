import { useCallback, useMemo, useReducer } from 'react';

export const initialState = {
  stage: 0,            // 0 Apply, 1 Learn, 2 Placed (follows the scene's 'stagechange', i.e. set when a walk COMPLETES)
  walkingTo: null,     // target stage while a walk is in flight (latest request wins), else null
  drawerOpen: false,
  formOpen: false,
  bookingOpen: false,
  menuOpen: false,
  mentorId: null,
  mentorPos: null,     // {x, y} in CSS pixels (viewport) for the 2D mentor card
  applied: false       // booking was opened as part of the Apply flow (so closing it advances to stage 1)
};

function reducer(s, a) {
  switch (a.type) {
    case 'stage': return s.stage === a.stage ? s : { ...s, stage: a.stage };
    case 'walk': return s.walkingTo === a.to ? s : { ...s, walkingTo: a.to };
    case 'drawer': return s.drawerOpen === a.open ? s : { ...s, drawerOpen: a.open, mentorId: null, mentorPos: null };
    case 'form': return s.formOpen === a.open ? s : { ...s, formOpen: a.open, menuOpen: a.open ? false : s.menuOpen, mentorId: null, mentorPos: null };
    case 'booking': return { ...s, bookingOpen: a.open, applied: a.open ? !!a.applied : false, mentorId: null, mentorPos: null };
    case 'menu': return s.menuOpen === a.open ? s : { ...s, menuOpen: a.open };
    case 'mentor': return { ...s, mentorId: a.id, mentorPos: a.id ? a.pos || null : null };
    default: return s;
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const setStage = useCallback((stage) => dispatch({ type: 'stage', stage }), []);
  const setWalking = useCallback((to) => dispatch({ type: 'walk', to }), []);
  const setDrawer = useCallback((open) => dispatch({ type: 'drawer', open }), []);
  const setForm = useCallback((open) => dispatch({ type: 'form', open }), []);
  const setBooking = useCallback((open, applied = false) => dispatch({ type: 'booking', open, applied }), []);
  const setMenu = useCallback((open) => dispatch({ type: 'menu', open }), []);
  const setMentor = useCallback((id, pos) => dispatch({ type: 'mentor', id, pos }), []);
  const actions = useMemo(() => ({ setStage, setWalking, setDrawer, setForm, setBooking, setMenu, setMentor }),
    [setStage, setWalking, setDrawer, setForm, setBooking, setMenu, setMentor]);
  return [state, actions];
}
