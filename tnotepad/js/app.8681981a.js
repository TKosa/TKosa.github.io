(function(e){function t(t){for(var s,a,o=t[0],c=t[1],l=t[2],u=0,h=[];u<o.length;u++)a=o[u],Object.prototype.hasOwnProperty.call(i,a)&&i[a]&&h.push(i[a][0]),i[a]=0;for(s in c)Object.prototype.hasOwnProperty.call(c,s)&&(e[s]=c[s]);d&&d(t);while(h.length)h.shift()();return r.push.apply(r,l||[]),n()}function n(){for(var e,t=0;t<r.length;t++){for(var n=r[t],s=!0,o=1;o<n.length;o++){var c=n[o];0!==i[c]&&(s=!1)}s&&(r.splice(t--,1),e=a(a.s=n[0]))}return e}var s={},i={app:0},r=[];function a(t){if(s[t])return s[t].exports;var n=s[t]={i:t,l:!1,exports:{}};return e[t].call(n.exports,n,n.exports,a),n.l=!0,n.exports}a.m=e,a.c=s,a.d=function(e,t,n){a.o(e,t)||Object.defineProperty(e,t,{enumerable:!0,get:n})},a.r=function(e){"undefined"!==typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},a.t=function(e,t){if(1&t&&(e=a(e)),8&t)return e;if(4&t&&"object"===typeof e&&e&&e.__esModule)return e;var n=Object.create(null);if(a.r(n),Object.defineProperty(n,"default",{enumerable:!0,value:e}),2&t&&"string"!=typeof e)for(var s in e)a.d(n,s,function(t){return e[t]}.bind(null,s));return n},a.n=function(e){var t=e&&e.__esModule?function(){return e["default"]}:function(){return e};return a.d(t,"a",t),t},a.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},a.p="/tnotepad/";var o=window["webpackJsonp"]=window["webpackJsonp"]||[],c=o.push.bind(o);o.push=t,o=o.slice();for(var l=0;l<o.length;l++)t(o[l]);var d=c;r.push([0,"chunk-vendors"]),n()})({0:function(e,t,n){e.exports=n("56d7")},"166d":function(e,t,n){},"48ba":function(e,t,n){"use strict";var s=n("5eab"),i=n.n(s);i.a},"56d7":function(e,t,n){"use strict";n.r(t);var s=n("2b0e"),i=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",{attrs:{id:"AllContainer"}},[n("ActionsBar",{attrs:{id:"ActionsBar"}}),n("NoteContainer",{ref:"NoteContainer"})],1)},r=[],a=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",[n("div",{attrs:{id:"actionsBar"}},[n("div",{staticClass:"button cell",attrs:{id:"download_button"},on:{click:e.download}},[n("u",[e._v("D")]),e._v("ownload ")]),n("div",{staticClass:"button cell",attrs:{id:"upload_button"},on:{click:e.clickInput}},[n("u",[e._v("U")]),e._v("pload ")]),n("input",{staticClass:"cell",staticStyle:{display:"none"},attrs:{id:"in",type:"file",accept:".tnp"}})])])},o=[],c={name:"ActionsBar",components:{},data(){return{inputElement:null}},methods:{download(){var e=JSON.stringify(this.$store.state),t=new Blob([e],{type:"application/octet-binary"}),n=document.createElement("a");n.setAttribute("href",URL.createObjectURL(t)),this.stripTrailingStarOffTitleIfExists(),n.setAttribute("download",document.title+".tnp"),n.click()},upload(){var e=this.$store,t=this.inputElement.files[0];t.text().then(function(n){var s=JSON.parse(n),i=t.name.slice(0,-4);"Vue App"==document.title&&setTimeout((function(){document.title=i}),50),e.commit("loadState",{new_state:s,fileTitle:i})}.bind(this)),this.inputElement.value=null},clickInput(){this.inputElement.click()},stripTrailingStarOffTitleIfExists(){document.title.endsWith("*")&&(document.title=document.title.slice(0,document.title.length-1))},returnCopyWithoutOrphans(e){var t,n=JSON.parse(JSON.stringify(e));for(t in e)0!=t&&0==n[t].parents.length&&delete n[t];return n}},created(){document.addEventListener("keydown",e=>{switch(e.key){case"d":e.ctrlKey&&(e.preventDefault(),this.download());break;case"u":var t=this.$parent.$refs.NoteContainer;if(t.focusedInstance.isEditable)break;e.ctrlKey&&(e.preventDefault(),document.getElementById("in").click());break}})},mounted(){this.inputElement=document.getElementById("in"),this.inputElement.addEventListener("input",e=>{this.upload()})}},l=c,d=(n("48ba"),n("2877")),u=Object(d["a"])(l,a,o,!1,null,"021ecef2",null),h=u.exports,p=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",{class:{focused:e.isFocused},attrs:{id:"NoteContainer"}},[n("NoteInstance",{staticClass:"instance",attrs:{noteid:0}})],1)},f=[],v=n("2f62"),b=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",{class:{shiftRight:e.parentIsNotRoot},attrs:{id:"root"}},[n("div",{ref:"topLine",class:{flex:!0,border:!0,selected:e.isSelected,focused:e.isFocused,hidden:e.isRoot},attrs:{id:"topLine"},on:{click:e.focus,contextmenu:function(t){return t.preventDefault(),e.onRightClick(t)}}},[n("button",{class:{boldText:e.hasChildren},on:{click:e.toggleButton}},[e._v(" "+e._s(e.button_text)+" ")]),n("textarea",{directives:[{name:"show",rawName:"v-show",value:e.isEditable,expression:"isEditable"},{name:"model",rawName:"v-model:value",value:e.markup,expression:"markup",arg:"value"}],ref:"textarea",staticClass:"contentBox",attrs:{type:"text"},domProps:{value:e.markup},on:{input:function(t){t.target.composing||(e.markup=t.target.value)}}}),n("span",{directives:[{name:"show",rawName:"v-show",value:!e.isEditable,expression:"!isEditable"}],ref:"contentSpan",staticClass:"contentBox",attrs:{id:"contentSpan"},domProps:{innerHTML:e._s(e.markup)}})]),n("keep-alive",[e.isExpanded?n("div",{ref:"childrenDiv",attrs:{id:"childrenDiv"}},e._l(e.children,(function(e){return n("NoteInstance",{key:e,attrs:{noteid:e}})})),1):e._e()]),n("vue-context",{ref:"contextmenu"},[n("li",[n("a",{attrs:{href:"#"},on:{click:function(t){return t.preventDefault(),e.noteContainer.DeepCopy(t)}}},[e._v("Deep Copy")])]),n("li",[n("a",{attrs:{href:"#"},on:{click:function(t){return t.preventDefault(),e.noteContainer.hardDeleteAllSelectedInstances(t)}}},[e._v("Hard Delete")])])])],1)},m=[],g=n("899b"),I={name:"NoteInstance",components:{VueContext:g["a"]},props:{noteid:Number},data(){return{noteContainer:this.$parent.noteContainer,downArrow:"˅",rightArrow:">",button_text:">",isEditable:!1}},methods:{ctxmenuOptionOnClick(e){console.log(`Innertext is ${e}`)},onRightClick(e,t){this.$refs.contextmenu.open(e,t),this.focus(e)},resize(){var e=this.$refs.topLine.style,t=this.isEditable?this.$refs.textarea:this.$refs.contentSpan;e.height=0,e.height=t.scrollHeight+"px"},focus(e){var t=!!e&&e.ctrlKey;this.noteContainer.focus(this,t)},addNote(e){this.$store.commit("addChildToParent",{child:e,parent:this.note})},getPreviousVisibleInstance(){if(this.$parent==this.noteContainer&&0==this.indexAsSibling)return this;var e=this.getPreviousSibling();if(e){while(e.isExpanded&&e.hasChildren)e=e.getLastChild();return e}return this.$parent},getNextVisibleInstance(){if(this.isExpanded&&this.hasChildren){var e=this.note.children[0],t=this.$store.state.notes[e],n=this.$children.filter(e=>e.note==t)[0];return n}var s=function(e){if(e.isRoot)return e;var t=e.getNextSibling();return null!=t?t:s(e.$parent)},i=s(this);return i.isRoot?this:i},getPreviousSibling(){var e=this.$parent.note.children,t=e.indexOf(this.note.id);if(t<1)return null;var n=e[t-1],s=this.$store.state.notes[n],i=this.$parent.getChildInstances().filter(e=>e.note==s)[0];return i},getNextSibling(){var e=this.$parent.note.children,t=e.indexOf(this.note.id);if(t==e.length-1)return null;var n=e[t+1],s=this.$store.state.notes[n],i=this.$parent.getChildInstances().filter(e=>e.note==s)[0];return i},getLastChild(){return this.childInstances[this.childInstances.length-1]},toggleButton(){this.button_text=this.button_text==this.rightArrow?this.downArrow:this.rightArrow},expand(){this.button_text=this.downArrow},expand_N_levels(e){e>=1&&this.expand(),e>1&&this.$nextTick(function(){this.getChildInstances().forEach((function(t){t.expand_N_levels(e-1)}))}.bind(this))},collapse_N_levels(e){0==e?this.collapse():this.getChildInstances().forEach((function(t){t.collapse_N_levels(e-1)}))},collapse(){this.button_text=this.rightArrow},removeFromParent(){this.$store.commit("removeChildFromParent",{child:this.note,parent:this.$parent.note})},getChildInstances(){var e=this.$children,t=e.filter(e=>void 0!=e.note);return t},getChildInstance(e){return this.$children.filter(t=>t.note==e)[0]},getIndexAsSibling(){return this.isRoot?0:this.$parent.childInstances.indexOf(this)},addTag(e){var t=function(e){var t;switch(e){case"b":t=/<\/?b>/g;break;case"u":t=/<\/?u>/g;break;case"i":t=/<\/?i>/g;break}var n=this.markup.match(t);if(void 0==n)return!1;var s=n[n.length-1];return s!="</"+e+">"}.bind(this),n="<"+(t(e)?"/":"")+e+">";this.markup+=n},hardDelete(){this.note.parents.forEach(function(e){this.$store.commit("removeChildFromParent",{child:this.note,parent:this.allNotes[e]})}.bind(this))}},computed:{...Object(v["b"])({children(e){return e.notes[this.noteid].children},note(e){return e.notes[this.noteid]},allNotes(e){return e.notes},parentNote(e){if(!this.isRoot)return e.notes[this.$parent.note.id]}}),markup:{set(e){this.$store.commit("setMarkup",{note:this.note,markup:e}),this.resize()},get(){return this.note.markup}},path(){return this.$parent==this.noteContainer?[this]:[...this.$parent.path,this]},isVisible(){return this.$parent==this.noteContainer||!(!this.$parent.isVisible||!this.$parent.isExpanded)},childInstances(){return this.getChildInstances()},isSelected(){return this.noteContainer.selectedInstances.includes(this)},isFocused(){return this.noteContainer.focusedInstance==this},isExpanded(){return this.button_text==this.downArrow},indexAsSibling(){return this.getIndexAsSibling()},textarea(){return this.$refs.textarea},hasChildren(){return this.note.children.length>0},isRoot(){return 0==this.noteid},parentIsNotRoot(){return!this.$parent.isRoot},level(){return this.isRoot?0:this.$parent.level+1}},watch:{isEditable:function(e,t){this.$nextTick((function(){this.resize(),this.textarea&&this.textarea.focus()})),1==e&&(this.markup=this.markup.replace("&lt","/<").replace("&gt","/>")),0==e&&(this.markup=this.markup.replace("/<","&lt").replace("/>","&gt"))},markup:function(){document.title.endsWith("*")||(document.title+="*"),window.tnk=this.textarea},children:function(){document.title.endsWith("*")||(document.title+="*")}},mounted(){this.resize(),this.isRoot&&(this.focus(),this.button_text=this.downArrow)}},k=I,x=(n("ea00"),n("9d0d"),Object(d["a"])(k,b,m,!1,null,"03c16f82",null)),w=x.exports,y={obj_val_replace:function(e,t,n){if(t!=n&&e){var s;for(s in e)s==t&&(e[n]=e[t],delete e[t]);for(s in e)if("markup"!=s){var i=e[s];i==t&&(e[s]=n),"object"==typeof i&&(i instanceof Array?e[s]=i.map(e=>e==t?n:e):this.obj_val_replace(i,t,n))}}},shiftDuplicateIDs:function(e,t){var n,s=0;for(n in e)n in t&&(s=this.getNextValidID(t,e,s),this.obj_val_replace(e,n,s))},getNextValidID(e,t,n){var s=n;while(s in e||s in t)s++;return s}};s["a"].use(v["a"]);class ${constructor(e){this.id=e,this.markup="",this.children=[],this.parents=[]}}var C=new v["a"].Store({state:{notes:{0:{id:0,markup:"0",children:[],parents:[]}},settings:{showMarkup:!0},version:2,conversions:{2:function(){var e;for(e in this.notes){var t=this.notes[e];t.markup=t.markup.replace("<br/>","\r\n")}}}},getters:{nextID:e=>{var t=e.notes,n=Object.keys(t);return n.length},getNoteByID:e=>t=>e.notes[t]},mutations:{setMarkup(e,{note:t,markup:n}){t.markup=n},registerNewNote(e,t){var n=new $(t);e.notes={...e.notes,[t]:n}},addChildToParent(e,{child:t,parent:n}){n.children.push(t.id),t.parents.push(n.id)},removeChildFromParent(e,{child:t,parent:n}){n.children=n.children.filter(e=>e!=t.id)},loadState(e,{new_state:t,fileTitle:n}){while(t.version<e.version){var s=e.conversions[t.version+1];null!=s&&s.apply(t),t.version+=1}var i=t.notes,r=i[0],a=e.notes[0];0==e.notes[0].children.length?this.replaceState(t):(y.shiftDuplicateIDs(i,e.notes),this.state.notes=Object.assign({},this.state.notes,i),this.commit("addChildToParent",{child:r,parent:a}),r.markup=n)}}});const _={COPY:1,CUT:2,DEEPCOPY:3};var E={name:"NoteContainer",components:{NoteInstance:w},data(){return{_selectedInstances:[null],_focusedInstance:null,noteContainer:this,copiedInstances:[],copy_state:null,active_modes:{b:!1,i:!1,u:!1}}},methods:{onRightClick(e){alert(`You clicked ${e}!`)},select(e,t=!1){t||(this.selectedInstances=[]),this.selectedInstances=[...this.selectedInstances,e]},focus(e,t=!1){this.focusedInstance=e,this.select(e,t)},clearSelectedInstances(){this.selectedInstances=[]},getNewNote(){var e=this.$store.getters.nextID;this.$store.commit("registerNewNote",e);var t=this.$store.getters.getNoteByID(e);return t},swapInstances(e,t){if(e.$parent==t.$parent){var n=e.$parent.note,s=n.children.indexOf(e.note.id),i=t.$parent.note,r=i.children.indexOf(t.note.id);n.children[s]=t.note.id,i.children[r]=e.note.id,e.$parent.$forceUpdate(),e.$parent!=t.$parent&&t.$forceUpdate()}},addSelectedInstancesToClipboard(){this.copiedInstances=this.selectedInstances.filter(e=>!0)},canCopy(e,t){return!(e.getChildInstances().filter(e=>e.note==t.note).length>0)&&e.note!=t.note},copyOne(e,t,n){n==_.CUT&&t.removeFromParent(),[_.CUT,_.COPY].includes(n)?(e.addNote(t.note),e.expand()):n==_.DEEPCOPY&&(this.deepCopy(e,t),e.expand())},deepCopy(e,t){var n=this.$store.getters.nextID;this.$store.commit("registerNewNote",n);var s=this.$store.getters.getNoteByID(n);s.markup=t.note.markup,s.children=t.note.children.filter(e=>!0),s.parents=t.note.parents.filter(e=>!0),this.$store.commit("addChildToParent",{child:s,parent:e})},hardDeleteAllSelectedInstances(){this.selectedInstances.forEach(e=>e.hardDelete())}},computed:{selectedInstances:{set(e){this.$data._selectedInstances=e},get(){return this.$data._selectedInstances}},focusedInstance:{set(e){this.$data._focusedInstance=e},get(){return this.$data._focusedInstance}},showMarkup:{set(e){this.$store.state.settings.showMarkup=e},get(){return this.$store.state.settings.showMarkup}},isFocused(){return this.focusedInstance==this.$children[0]},children(){return this.$children},rootInstance(){return this.$children[0]}},created(){document.addEventListener("keydown",e=>{switch(e.key){case"Enter":if(this.focusedInstance.isRoot)break;this.focusedInstance.isEditable||(this.focusedInstance.isEditable=!0,e.preventDefault());break;case"Alt":e.preventDefault(),this.focusedInstance.isEditable&&(this.focusedInstance.isEditable=!1);break;case"Insert":if(e.preventDefault(),this.focusedInstance.isEditable)break;var t=this.getNewNote();this.selectedInstances.forEach((function(e){e.addNote(t),e.expand()})),this.$nextTick(function(){var n=this.focusedInstance.getChildInstances(),s=n.filter(e=>e.note==t)[0];e.altKey||s.focus()}.bind(this));break;case"ArrowUp":case"ArrowDown":if(this.focusedInstance.isEditable)break;if(e.shiftKey&&e.ctrlKey)break;e.preventDefault();var n,s=this.focusedInstance;if("ArrowUp"==e.key&&(n=s.getPreviousVisibleInstance()),"ArrowDown"==e.key&&(n=s.getNextVisibleInstance()),null==n)return;e.shiftKey||this.focus(n,e.ctrlKey),e.shiftKey&&(this.swapInstances(s,n),document.title.endsWith("*")||(document.title+="*"));break;case"ArrowLeft":if(this.focusedInstance.isEditable)break;if(e.preventDefault(),this.focusedInstance.isRoot)break;this.focusedInstance.$parent.focus();break;case"ArrowRight":if(this.focusedInstance.isEditable)break;e.preventDefault(),this.focusedInstance.expand(),this.$nextTick(()=>{var e=this.focusedInstance.getChildInstances();e.length>0&&e[0].focus()});break;case"Tab":if(e.preventDefault(),this.focusedInstance.isRoot)break;if(this.focusedInstance.isEditable)break;this.selectedInstances.forEach((function(e){e.toggleButton()}));break;case"Delete":if(e.preventDefault(),this.focusedInstance.isEditable)break;if(0==this.focusedInstance.noteid)break;var i=this.focusedInstance.getPreviousVisibleInstance();while(i in this.selectedInstances)i=i.getPreviousVisibleInstance();this.selectedInstances.forEach((function(e){e.removeFromParent()})),i.focus();break;case"c":case"x":case"b":!this.focusedInstance.isEditable&&e.ctrlKey&&("c"==e.key&&(this.copy_state=_.COPY),"x"==e.key&&(this.copy_state=_.CUT),"b"==e.key&&(this.copy_state=_.DEEPCOPY),this.addSelectedInstancesToClipboard());break;case"v":!this.focusedInstance.isEditable&&e.ctrlKey&&this.selectedInstances.forEach(function(e){this.copiedInstances.forEach(function(t){this.canCopy(e,t)&&this.copyOne(e,t,this.copy_state)}.bind(this))}.bind(this));break;case"0":case"1":case"2":case"3":case"4":case"5":case"6":case"7":case"8":case"9":e.ctrlKey&&(e.preventDefault(),e.altKey?this.focusedInstance.expand_N_levels(Number.parseInt(e.key)):this.focusedInstance.collapse_N_levels(Number.parseInt(e.key)));break;case"r":if(!e.ctrlKey)break;e.preventDefault();var r=prompt("Enter a new title: ",document.title);document.title=r;break}}),document.addEventListener("keydown",e=>{switch(e.key){case"b":case"u":case"i":if(this.focusedInstance.isEditable&&e.ctrlKey){e.preventDefault();var t=this.focusedInstance.textarea;if(t.selectionStart==t.selectionEnd)this.focusedInstance.addTag(e.key);else{var n=this.focusedInstance.markup,s=t.selectionStart,i=t.selectionEnd;this.focusedInstance.markup=n.slice(0,s)+`<${e.key}>`+n.slice(s,i)+`</${e.key}>`+n.slice(i)}}break}})},mounted(){}},N=E,D=(n("61bf"),Object(d["a"])(N,p,f,!1,null,"f7e96f4a",null)),O=D.exports,S={name:"App",components:{ActionsBar:h,NoteContainer:O},mounted(){window.onbeforeunload=function(){if(document.title.endsWith("*"))return""}}},P=S,A=(n("beb3"),Object(d["a"])(P,i,r,!1,null,"29e21614",null)),T=A.exports;s["a"].config.productionTip=!1,window.vue=new s["a"]({store:C,render:e=>e(T)}).$mount("#app")},"5eab":function(e,t,n){},"61bf":function(e,t,n){"use strict";var s=n("a078"),i=n.n(s);i.a},"7e44":function(e,t,n){},"9d0d":function(e,t,n){"use strict";var s=n("166d"),i=n.n(s);i.a},a078:function(e,t,n){},beb3:function(e,t,n){"use strict";var s=n("7e44"),i=n.n(s);i.a},ea00:function(e,t,n){"use strict";var s=n("ebb8"),i=n.n(s);i.a},ebb8:function(e,t,n){}});
//# sourceMappingURL=app.8681981a.js.map