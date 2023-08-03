const { Client, GatewayIntentBits } = require("discord.js");
const client = new Client({
  intents: Object.values(GatewayIntentBits).reduce((a, b) => a | b)
});
const axios = require(`axios`);


/////////////////////////
//環境設定
//APIキーなどの設定読み込み
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GAS_API_URL = process.env.GAS_API_URL;
const ANNOUNCE_CHANNEL = process.env.ANNOUNCE_CHANNEL;
const ISSUE_TOKEN_SHEET = process.env.ISSUE_TOKEN_SHEET;

const MEETING_TITLE = `Metagriミーティングが設定されました！`;

//タイムゾーンを日本標準時に変更するためのオプション（海外サーバーで実行されたとき用）
const timezoneoptions = {
  timeZone: 'Asia/Tokyo',
  hour12: false, 
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit', 
  minute: '2-digit', 
  second: '2-digit'
};

/////////////////////////////////////
/////////////////////////////////////
//GASへポストするデータとメソッドをclass化
class PostGas {
  constructor(channel,message) {
    //GASへポストするデータ
    this.data =  {
      action: "",
      sheetName: ISSUE_TOKEN_SHEET,//トークン発行ならこのシート、他のシートにもアップロードするなら要検討・・・・・・・・・
      rows: []
    }
    this.channel = channel;//トークンが発行されたことをお知らせするチャンネル
    this.message = message;//DiscordAPIのメッセージクラス
  }
  //更新する発行データを追加するメソッド
  pushdata(data){
    this.data.rows.push(data);
  }
  //GASへのデータ送信とお知らせチャンネルへのメッセージ送信
  postAxios(resprompt,errprompt){
    axios.post(GAS_API_URL, this.data)
      .then(response => {
        console.log('POSTリクエストが成功しました。');
        this.channel.send(resprompt);
      })
      .catch(error => {
        console.error('POSTリクエストが失敗しました。');
        this.message.reply(errprompt);
    });
  }
  //トークンを発行するメソッド
  insertGas(){
    this.data.action = "insert";
    let resprompt = ``;
    this.data.rows.map((user)=>{
      resprompt = `${resprompt}<@!${user.userID}>さん\n`;
    });
    resprompt = `${resprompt}${this.message.author.tag}さんから${this.data.rows[0].issue}枚のMLTTの発行が申請されました`;
    const errprompt = `<@${this.data.rows[0].issuerID}>MLTTの発行申請に失敗しました`;
    this.postAxios(resprompt,errprompt);
  }
  //トークン発行をキャンセルするメソッド
  deleteGas(){
    this.data.action = "delete";
    let resprompt = ``;
    this.data.rows.map((user)=>{
      resprompt = `${resprompt}<@!${user.userID}>さん\n`;
    });
    resprompt = `ごめんなさい、さっきのMLTT発行申請はキャンセルされました。`;
    const errprompt = `<@${this.data.rows[0].issuerID}>MLTT発行申請の削除に失敗しました`;
    this.postAxios(resprompt,errprompt);
  }
}

//////////////////////////////////
//ログイン状態の設定
client.on("ready", async() => {
  console.log(`Bot準備完了！${client.user.tag} でログインしています。`);
  client.user.setPresence({ activity: { name: '投稿チェック' } });
  
  createCommand(client);
});

///////////////////////////////
//メッセージが投稿されたときの反応
client.on("messageCreate", async message => {
  //メッセージ投稿者がBotなら反応しない
  if (message.author.id == client.user.id || message.author.bot) return;
  
  /////////////////////////////////
  //メンションによるトークンの発行
  /////////////////////////////////
  if (message.mentions.has(client.user) && !message.mentions.everyone) {//自分がメンションされ、なおかつeveryoneやhereでなければ反応
    process.env.TOKEN_CHANNEL = ANNOUNCE_CHANNEL || message.channel;//お知らせチャンネルが設定されていなければ返信で対応
    const channel = client.channels.cache.get(ANNOUNCE_CHANNEL);
    const postGas = new PostGas(channel,message);
    //正規表現で発行枚数を取得
    const regex = /(\d+)枚/; // 「枚」の直前の数字の1回以上の繰り返しを表す正規表現
    const matches = message.content.match(regex);
    const integerPart = matches ? parseInt(matches[0]) : null;//最初に検出された数字
    let issue = integerPart || 1;//発行枚数が検出されなければ１
    //メッセージが送信された日時を日本標準時に変更
    const now = new Date();
    const date = new Intl.DateTimeFormat('ja-JP', timezoneoptions).format(now);
    //メンションされているユーザーごとに実行
    message.mentions.users.map((user) =>{
      //メンションされているのがbot以外なら実行
      if(user.id != client.user.id){
        //GASへ送信するデータ形式の作成
        let issuedata = {
          messageID: message.id,
          date: date,
          userID: user.id,
          userName: user.tag,
          issuerID: message.author.id,
          issuerName: message.author.tag,
          issue: issue};
        //GASへ送信するデータを追加
        postGas.pushdata(issuedata);
      }
    });
    //GASへ発行データをPOST
    postGas.insertGas();
  }//メンションでの反応はここまで
  
});

const createCommand = async(client)=>{
  // スラッシュコマンドを定義する
  const data = [{
    name: 'checktokens',
    description: '現在申請されているトークンの確認を行います'/*,
    options:[{
       name: "me",
       description: "自分宛てに発行申請されているトークン",
      },{
       name: "all",
       description: "全員の発行申請されているトークン"
      }]*/
  },
  {
    name: 'meeting',
    description: 'MLTT配布対象のミーティングを設定します',
    options: [
        {
          name: 'date',
          type: 3,
          description: 'ミーティングの日付を YYYYMMDD の形で入力してください。ハイフンなど記号は使わないでください',
          required: true,
        },
        {
          name: 'start-time',
          type: 3,
          description: '開始時刻を HHMM (24 hour)の形で入力してください。ハイフンなど記号は使わないでください',
          required: true,
        },
        {
          name: 'content',
          type: 3,
          description: 'リンクURLや招待メッセージを入力してください',
          required: true,
        },
        {
          name: 'time',
          type: 4,
          description: 'ミーティング時間を入力してください',
          required: false,
        },
      ],
               }];
  
  // スラッシュコマンドを登録する
  client.application.commands.set(data)
    .then(command => console.log(command))
    .catch(console.error);
  console.log("スラッシュコマンドの登録が完了しました");
  
  //ローカルギルドにスラッシュコマンドを登録する方法
  // const guild = client.guilds.cache.get('ギルドID');
  // await guild.commands.set(data);

}

// スラッシュコマンドが実行されたときの処理を定義
client.on('interactionCreate', async interaction => {
  //トークンの申請数を確認する
  if (interaction.isCommand() && interaction.commandName === 'checktokens') {
    const data = {action: 'checktokens',target: 'all'}
    try {
      const response = await axios.get(GAS_API_URL);
      const result = Object.entries(response.data);
      let message = "";
      result.forEach(data=>{
        message += `${data[0]}さん、${data[1]}枚\n`;
      });
      //ephemeral:trueにより、コマンド実行者にしか見えない一時的なメッセージとして送信
      await interaction.reply({content: message, ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({content:'データの取得に失敗しました',ephemeral: true});
    }
  }
  //meetingコマンドが実行されたとき
  if (interaction.isCommand() && interaction.commandName === 'meeting') {
    const date = interaction.options.getString('date');
    const startTime = interaction.options.getString('start-time');
    const time = interaction.options.getInteger('time')||1;//会議時間が設定されていない場合は1を設定
    const content = interaction.options.getString('content');
    
    // YYYYMMDD形式とHHMM形式をチェック
    if (!/^\d{8}$/.test(date) || !/^\d{4}$/.test(startTime)) {
        console.error('Invalid date or start-time format');
        await interaction.reply({content:'日付と開始時刻は半角数字のみで入力してください',ephemeral: true});
        return;
    }
    // YYYYMMDD形式を解析
    const year = parseInt(date.substring(0, 4), 10);
    const month = parseInt(date.substring(4, 6), 10) - 1; // JavaScriptの月は0-11
    const day = parseInt(date.substring(6, 8), 10);

    // HHMM形式を解析
    const hours = parseInt(startTime.substring(0, 2), 10);
    const minutes = parseInt(startTime.substring(2, 4), 10);

    // Dateオブジェクトを作成
    const dateTime = new Date(year, month, day, hours, minutes);

    // 妥当性をチェック
    if (!(dateTime.getFullYear() === year && dateTime.getMonth() === month &&
        dateTime.getDate() === day && dateTime.getHours() === hours && dateTime.getMinutes() === minutes)) {
        console.error('Invalid date or start-time values');
        await interaction.reply({content:'日付と開始時刻に有効な日時を入力してください',ephemeral: true});
        return;
    }

    // date and startTime を適切な形式に変換します
    const formattedDate = `${date.slice(0, 4)}年${date.slice(4, 6)}月${date.slice(6, 8)}日`;
    const formattedStartTime = `${startTime.slice(0, 2)}時${startTime.slice(2, 4)}分`;

    // メッセージをフォーマットします
    const message = `${MEETING_TITLE}\n${formattedDate}\n${formattedStartTime}開始\n予定時間${time}時間\n\n${content}\nミーティング設定者\n${interaction.user.tag}\n${interaction.user.id}`;

    // メッセージを送信し、そのレスポンスを取得します
    let sentMessage = await interaction.reply({ content: message, fetchReply: true });
    
    //デフォルトのリアクションを追加したかったが、うまく動作せず
    // リアクションを追加します
    // if ('message' in sentMessage) {
    //   await sentMessage.message.react('👍');
    // }
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  // Bot自身によるリアクションを無視
  if (user.id === client.user.id) return;
  
  // メッセージを取得
  const message = await reaction.message.fetch();
  //お知らせちゃんねるの取得とGASへのデータ送信クラスの作成
  const channel = client.channels.cache.get(ANNOUNCE_CHANNEL);
  const postGas = new PostGas(channel,message);
  // すべてのリアクションを取得
  const reactions = message.reactions.cache;
  // ユーザーが反応したリアクションをカウント
    let userReactionCount = 0;
    // リアクションごとにループを回す
    for (const [, messageReaction] of reactions) {
      // そのリアクションにユーザーが反応しているか確認
      const reactionUsers = await messageReaction.users.fetch();
      // ユーザーが反応している場合、カウントアップ
      if (reactionUsers.has(user.id)) userReactionCount++;
    }
    // ユーザーが2回以上反応している場合、処理を中止
    if (userReactionCount >= 2) return;
  

  // メッセージの内容と送信者をチェック
  if (message.content.startsWith(MEETING_TITLE) && message.author.id === client.user.id) {
    // メッセージから日付と開始時間を取得する
    const lines = message.content.split('\n');
    const dateLine = lines[1];
    const timeLine = lines[2];
    const durationLine = lines[3];

    const dateParts = dateLine.match(/(\d{4})年(\d{2})月(\d{2})日/);
    const timeParts = timeLine.match(/(\d{2})時(\d{2})分開始/);
    const durationParts = durationLine.match(/(\d+)時間/);

    if (!dateParts || !timeParts || !durationParts) return;

    const year = Number(dateParts[1]);
    const month = Number(dateParts[2]);
    const day = Number(dateParts[3]);
    const hour = Number(timeParts[1]);
    const minute = Number(timeParts[2]);
    const duration = Number(durationParts[1]);

    // 開始時間と終了時間を計算する
    const startTime = new Date(year, month - 1, day, hour, minute - 30);
    const endTime = new Date(year, month - 1, day, hour + duration, minute + 30);
    // サーバーの現在時刻を日本時間に変更
    const nowString = new Intl.DateTimeFormat('ja-JP', timezoneoptions).format(new Date());
    const nowParts = nowString.match(/(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    const now = new Date(Number(nowParts[1]), Number(nowParts[2]) - 1, Number(nowParts[3]), Number(nowParts[4]), Number(nowParts[5]), Number(nowParts[6]));

    // 現在時刻が許可される時間範囲内であるかチェックする
    if (now >= startTime && now <= endTime) {
      const regex = /ミーティング設定者\n([^\n]+)\n(\d+)/;
      const matches = message.content.match(regex);
      const username = matches[1];
      const userId = matches[2];
      console.log(`${user.username} has reacted to the meeting message!${username}${userId}`);
      let issuedata = {
          messageID: message.id,
          date: nowString,
          userID: user.id,
          userName: user.tag,
          issuerID: userId,
          issuerName: username,
          issue: 1};
        //GASへ送信するデータを追加
        postGas.pushdata(issuedata);
      //GASへデータ送信
      postGas.insertGas();
      // リアクションが付与されたメッセージのチャンネルにメッセージを送信
      //reaction.message.channel.send(`User ${user.username} has reacted with ${reaction.emoji.name}`);
    }
  }
});


//BotのDiscordへのログイン
client.login(DISCORD_BOT_TOKEN);


//リアクションに反応するコード
// client.on('messageReactionAdd', (reaction, user) => {
//   const message = reaction.message;
//   //メッセージ送信元のuserクラスの取得
//   const member = message.author;
//   console.log(`${message.guild} で ${user.tag} が ${member.tag} に ${reaction.emoji.name} をリアクションしました${message.id}`);
//   reaction.message.channel.send(`${message.guild} で ${user.tag} が ${member.tag} に ${reaction.emoji.name} をリアクションしました。\n
//   messageid: ${message.id}`);
// });