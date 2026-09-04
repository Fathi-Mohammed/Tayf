const IDS = [
  'backdrop', 'panel', 'bar', 'prompt', 'search',
  'banner', 'fail', 'ok', 'filters', 'ctx', 'list', 'msg',
  'settings', 'snav', 'pconn', 'pnudge', 'pgen', 'pappearance', 'tokenlink',
  'ssite', 'semail', 'stoken', 'snote',
  'shotkey', 'saddkey', 'sauto', 'sautotext',
  'sthemes', 'smodes', 'sfonts',
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
