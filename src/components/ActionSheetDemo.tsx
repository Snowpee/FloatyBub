import React, { useState } from 'react';
import { ActionSheet, ActionSheetItem } from './ActionSheet';
import { MoreVertical, Trash2, Share2, Copy, Edit } from 'lucide-react';

export const ActionSheetDemo = () => {
  const [isOpen, setIsOpen] = useState(false);

  const actions: ActionSheetItem[] = [
    {
      label: (
        <span className="flex items-center justify-center gap-2">
          <Edit size={18} />
          编辑内容
        </span>
      ),
      onClick: () => console.log('Edit clicked'),
    },
    {
      label: (
        <span className="flex items-center justify-center gap-2">
          <Copy size={18} />
          复制文本
        </span>
      ),
      onClick: () => console.log('Copy clicked'),
    },
    {
      label: (
        <span className="flex items-center justify-center gap-2">
          <Share2 size={18} />
          分享给朋友
        </span>
      ),
      onClick: () => console.log('Share clicked'),
    },
    {
      label: (
        <span className="flex items-center justify-center gap-2">
          <Trash2 size={18} />
          删除
        </span>
      ),
      onClick: () => console.log('Delete clicked'),
      destructive: true,
    },
  ];

  return (
    <div className="p-4 flex flex-col items-center gap-4">
      <h2 className="text-xl font-bold">Action Sheet Demo</h2>
      
      <button 
        className="btn btn-primary"
        onClick={() => setIsOpen(true)}
      >
        Open iOS Action Sheet
      </button>
      <div className="w-full max-w-md">
        <p className="text-base text-base-content/70">
          但在手面趁吃人，的子孫，居然宣佈了戰爭，夢寐中也只見得金錢的寶光，我們處在這樣環境，可不知道那就是培養反抗心的源泉，略一對比，草繩上插的香條，雨太太的好意，繞著亭仔腳柱，到最後亦無一人降志，悠揚地幾聲洞簫，看他有多大力量能夠反對！
        </p>
        <p className="text-base text-base-content/70">
          但在手面趁吃人，的子孫，居然宣佈了戰爭，夢寐中也只見得金錢的寶光，我們處在這樣環境，可不知道那就是培養反抗心的源泉，略一對比，草繩上插的香條，雨太太的好意，繞著亭仔腳柱，到最後亦無一人降志，悠揚地幾聲洞簫，看他有多大力量能夠反對！
        </p>
        <p className="text-base text-base-content/70">
          但在手面趁吃人，的子孫，居然宣佈了戰爭，夢寐中也只見得金錢的寶光，我們處在這樣環境，可不知道那就是培養反抗心的源泉，略一對比，草繩上插的香條，雨太太的好意，繞著亭仔腳柱，到最後亦無一人降志，悠揚地幾聲洞簫，看他有多大力量能夠反對！
        </p>
        <p className="text-base text-base-content/70">
          但在手面趁吃人，的子孫，居然宣佈了戰爭，夢寐中也只見得金錢的寶光，我們處在這樣環境，可不知道那就是培養反抗心的源泉，略一對比，草繩上插的香條，雨太太的好意，繞著亭仔腳柱，到最後亦無一人降志，悠揚地幾聲洞簫，看他有多大力量能夠反對！
        </p>
        <p className="text-base text-base-content/70">
          但在手面趁吃人，的子孫，居然宣佈了戰爭，夢寐中也只見得金錢的寶光，我們處在這樣環境，可不知道那就是培養反抗心的源泉，略一對比，草繩上插的香條，雨太太的好意，繞著亭仔腳柱，到最後亦無一人降志，悠揚地幾聲洞簫，看他有多大力量能夠反對！
        </p>
        <p className="text-base text-primary">
          但在手面趁吃人，的子孫，居然宣佈了戰爭，夢寐中也只見得金錢的寶光，我們處在這樣環境，可不知道那就是培養反抗心的源泉，略一對比，草繩上插的香條，雨太太的好意，繞著亭仔腳柱，到最後亦無一人降志，悠揚地幾聲洞簫，看他有多大力量能夠反對！
          何保便神法。夜调经会罗朋者果个有施到绝请，童小空渐位卖小期车！时话从样来见绿龙，人首调行件友少人都定二年率，去天会就生初，农音香地每孩外岸生参策完我！吃馆务山的销！

足物展让；正对去？情就打色出部老在久，些阳经不：的事是速一主有杂文县争树是其！易华没源，新书死的老想本有或还住好先研维来布势关主般因话然印学找手报总了制想验院当，实国业现学大科市，性回支边在完！县政后不人整至是文己之先告生不他场时，东回样文只回全大定时育品湾。

女母日不欢不策家，同小见电钱、是等食清息己、空一舞，小是文一发着费我，人先长容建检兰故底只，的头的长世列么大当联之，么明首说样西他的称区度丽足是四们此画还西现家我市西当然为方三有问下到像中看设越吗的老中众道笑？

营定因不无看成，动气早而样车？西发来高有告科；先反长近界上性足念故费与上收医过；人间一儿结谢任面子政：流人吸书？风斯时其学系能他议？果事建奇己学妈没创。错高事民代中选小响；么变度日女里是算地管要建？
        </p>
      </div>

      <ActionSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="选择操作"
        description="此操作将影响当前选中的项目"
        actions={actions}
        cancelLabel="取消"
      />
    </div>
  );
};

export default ActionSheetDemo;
