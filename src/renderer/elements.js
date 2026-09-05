const IDS = [
  'backdrop', 'stage', 'side', 'panel', 'bar', 'prompt', 'search',
  'ctx', 'list', 'msg', 'toasts',
  'boardbar', 'filters', 'brdwrap', 'brdbtn', 'brdname', 'brdlist', 'views',
  'today', 'ringwrap', 'tsub', 'active', 'hints',
  'settings', 'snav', 'pconn', 'pnudge', 'pgen', 'pappear', 'tokenlink',
  'ssite', 'semail', 'stoken', 'snote',
  'shotkey', 'saddkey', 'sauto', 'sautotext', 'slanguage',
  'sappearance', 'stheme', 'sfont', 'sscale',
  'snudge', 'snudgeevery', 'snudgeidle', 'snudgestart', 'snudgeend', 'snudgedays',
  'snudgecheck', 'snudgecheckevery', 'snudgeoverdue', 'snudgeoverduedays', 'snudgestatuses',
  'view', 'vtitle', 'vmeta', 'vdesc',
  'create', 'lblboard', 'cboardwrap', 'cboard', 'cboardlist',
  'lbltype', 'ctype', 'lblassignee', 'cassigneewrap', 'cassignee', 'cassigneelist',
  'lbldue', 'duewrap', 'cdue', 'chips', 'lblest', 'cest',
  'lbldescin', 'cdescin', 'cnote', 'cdesc',
  'finish', 'ftask', 'lblfres', 'fres', 'lblftime', 'ftime', 'fest', 'fnote',
  'foot', 'meta', 'foots', 'metas', 'footv', 'metav',
  'footd', 'metad', 'footc', 'metac', 'footf', 'metaf',
  'actions'
];

const elements = Object.fromEntries(IDS.map((id) => [id, document.getElementById(id)]));

elements.composeGrid = elements.create.querySelector('.cgrid');
elements.finishGrid = elements.finish.querySelector('.cgrid');

export default elements;
