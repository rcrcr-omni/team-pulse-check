const { App , WorkflowStep} = require("@slack/bolt");
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { ChartConfiguration } = require('chart.js');
//const { annotationPlugin } = require('chartjs-plugin-annotation')
const fs = require('fs')
require("dotenv").config();
// Initializes your app with your bot token and signing secret
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode:true,
  appToken: process.env.APP_LEVEL_TOKEN
});

const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const cors = require("cors");

const exp = express();
const axios = require('axios')

const crypto = require('crypto')

let axiosConfig = {
  headers: {
      "Content-Type" : "application/json; charset=utf-8",
      "Accept": "Token",
      "Access-Control-Allow-Origin": "*",
      "X-Powered-By": "Express",
      "Connection": "keep-alive",
      "Keep-Alive": "timeout=5"
  }
};


// connect to database
const db = require("./app/models");
db.mongoose
  .connect(process.env.MONGODB_URI || db.url)
  .then(() => {
    console.log("Connected to the database!");
  })
  .catch(err => {
    console.log("Cannot connect to the database!", err);
    process.exit();
  });

  exp.use(cors());

  // hopefully serving a static folder to access rendered charts
  exp.use('/temp', express.static(process.cwd() + '/temp'))

  // Serve static files from the React app
  //app.use(express.static(path.join(__dirname, 'client/build')));

  // parse requests of content-type - application/json
  exp.use(bodyParser.json());

  // parse requests of content-type - application/x-www-form-urlencoded
  exp.use(bodyParser.urlencoded({ extended: true }));


  require("./app/routes/pulsecheck.routes")(exp);


// SLACK APP

const botName = 'Ignite Team Pulse'
const question = {
  one: "How are you doing generally (work + life all in one)?",
  two: "How are you currently feeling about the recent/ongoing changes at work, particularly around the (new) team?",
  three: "How sustainable is your current pace of work?"
}
const botPrompt = `Tell us how you are doing against the following questions on a scale from 1-5 \n(1 = :face_with_symbols_on_mouth::scream:, 5 = :rainbow::the_horns:)`

/*
// listen for messages to gather the data
app.event('message', async({message, say}) => {
  // check if the message is 1) a DM and 2) a response to the bot's prompt
  if(message.channel_type == "im") {
    app.client.conversations.history({
      token: process.env.SLACK_BOT_TOKEN,
      channel: message.channel,
      limit: 2
    }).then((response) => {
      //console.log(response.messages)
      if(response.messages[1].text == botPrompt && response.messages[1].bot_profile.name == botName) {
        const userResponse = message.text.replace(/\D/g, '').split("")
        // log responses in database
        say(`Thanks for checking in. Your responses were: \n>${question.one}: *${userResponse[0]}*\n>${question.two}: *${userResponse[1]}*\n>${question.three}: *${userResponse[2]}*\n`)
      } else {
        say("Sorry, I'm only able to process feedback I've asked for.")
      }
    })
  }
  // if not then tell them, thank you, but I can gather data on that day
})
*/

// Workflow step to message channel members and take their pulse
const ws = new WorkflowStep('new_pulse_take', {
  edit: async ({ ack, step, configure }) => {
    await ack();
    console.log('editing a step')
    const blocks = [
      {
        type: 'section',
        block_id: 'section_1',
        text: {
          type: "mrkdwn",
          text: "This step will send a DM to each member of the channel and ask them to answer three questions."
        }
      },
      {
        type: 'input',
        block_id: 'channel_name_input8474',
        element: {
          type: 'plain_text_input',
          action_id: 'channel8474',
          multiline: false,
          placeholder: {
            type: 'plain_text',
            text: 'Choose insert variable and select \'Channel where workflow started\'',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Channel',
        },
      },
      {
        type: 'input',
        block_id: 'response_window_input8474',
        element: {
          type: 'plain_text_input',
          action_id: 'window8474',
          multiline: false,
          initial_value: "2",
          placeholder: {
            type: 'plain_text',
            text: 'How many hours team members have to submit their response',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Response window (hours)',
        },
      },
      {
        type: 'input',
        block_id: 'botprompt8474',
        element: {
          type: 'plain_text_input',
          action_id: 'prompt8474',
          initial_value: botPrompt,
          multiline: true
        },
        label: {
          type: 'plain_text',
          text: 'Prompt',
        },
      },
      {
        type: 'input',
        block_id: 'question18474',
        element: {
          type: 'plain_text_input',
          action_id: 'question11111',
          initial_value: question.one,
          multiline: false
        },
        label: {
          type: 'plain_text',
          text: 'Question 1',
        },
      },
      {
        type: 'input',
        block_id: 'question28474',
        element: {
          type: 'plain_text_input',
          action_id: 'question22222',
          initial_value: question.two,
          multiline: false
        },
        label: {
          type: 'plain_text',
          text: 'Question 2',
        },
      },
      {
        type: 'input',
        block_id: 'question38474',
        element: {
          type: 'plain_text_input',
          action_id: 'question3333',
          initial_value: question.three,
          multiline: false
        },
        label: {
          type: 'plain_text',
          text: 'Question 3',
        },
      },
    ];

    await configure({ blocks });
  },
  save: async ({ ack, context, step, view, update }) => {
    await ack();
    const { values } = view.state
    const channel = values.channel_name_input8474.channel8474.value

    // OK. We need to capture some deets about the channel in order to come back to it later and to link it to the database
    const bot = context.botUserId // String
    console.log(bot)
    console.log(channel)

    var conversationId

    const botChannels = app.client.users.conversations({
        token: process.env.SLACK_BOT_TOKEN,
        user: bot,
        exclude_archived: true,
        types: "public_channel, private_channel, mpim"
      }).then((response) => {
        console.log(response.channels)
        for (const ch of response.channels) {
          if (ch.name === channel) {
            conversationId = ch.id
            console.log(`${channel} id is ${conversationId}`)
            break;
          }
        }

        const inputs = {
          channelName: {value: channel, skip_variable_replacement: false},
          conversationId: {value: conversationId},
          window: {value: values.response_window_input8474.window8474},
          prompt: {value: values.botprompt8474.prompt8474},
            qone: {value: values.question18474.question11111},
            qtwo: {value:values.question28474.question22222},
            qthree: {value:values.question38474.question3333}
          }

        const outputs = [{
          type: 'channel',
          name: 'channel',
          label: 'Channel name'
        }]

        axios({
          method: 'post',
          url: 'http://localhost:8080/api/channel/edit',
          params: {
            channel: channel,
            conversationId: conversationId,
            window: values.response_window_input8474.window8474.value
          }
        })
          .catch(err => console.log(err))

        console.log("saving step")



        update({ inputs, outputs });

      })
  },
  execute: async ({ step, context, complete, fail }) => {
  const questionParts = step.inputs
  const channelName = step.inputs.channelName.value.value
  const channel_id = step.inputs.conversationId.value
  const botMessage = `${questionParts.prompt.value.value}\n\n`
  const pulseId = crypto.randomBytes(8).toString("hex")
  const blocks = [
		{
			"type": "section",
      "block_id" : channel_id,
			"text": {
				"type": "mrkdwn",
				"text": questionParts.prompt.value.value
			}
		},
		{
			"type": "divider",
      "block_id": pulseId
		},
		{
			"type": "input",
      "block_id" : "responseOne",
			"element": {
				"type": "static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "I'm feeling...",
					"emoji": true
				},
				"options": [
					{
						"text": {
							"type": "plain_text",
							"text": "1",
							"emoji": true
						},
						"value": "1"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "2",
							"emoji": true
						},
						"value": "2"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "3",
							"emoji": true
						},
						"value": "3"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "4",
							"emoji": true
						},
						"value": "4"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "5",
							"emoji": true
						},
						"value": "5"
					}
				],
				"action_id": "static_select-action"
			},
			"label": {
				"type": "plain_text",
				"text": questionParts.qone.value.value,
				"emoji": true
			}
		},
		{
			"type": "input",
      "block_id" : "responseTwo",
			"element": {
				"type": "static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "I'm feeling...",
					"emoji": true
				},
				"options": [
					{
						"text": {
							"type": "plain_text",
							"text": "1",
							"emoji": true
						},
						"value": "1"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "2",
							"emoji": true
						},
						"value": "2"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "3",
							"emoji": true
						},
						"value": "3"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "4",
							"emoji": true
						},
						"value": "4"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "5",
							"emoji": true
						},
						"value": "5"
					}
				],
				"action_id": "static_select-action"
			},
			"label": {
				"type": "plain_text",
				"text": questionParts.qtwo.value.value,
				"emoji": true
			}
		},
		{
			"type": "input",
      "block_id" : "responseThree",
			"element": {
				"type": "static_select",
				"placeholder": {
					"type": "plain_text",
					"text": "I'm feeling...",
					"emoji": true
				},
				"options": [
					{
						"text": {
							"type": "plain_text",
							"text": "1",
							"emoji": true
						},
						"value": "1"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "2",
							"emoji": true
						},
						"value": "2"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "3",
							"emoji": true
						},
						"value": "3"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "4",
							"emoji": true
						},
						"value": "4"
					},
					{
						"text": {
							"type": "plain_text",
							"text": "5",
							"emoji": true
						},
						"value": "5"
					}
				],
				"action_id": "static_select-action"
			},
			"label": {
				"type": "plain_text",
				"text": questionParts.qthree.value.value,
				"emoji": true
			}
		},
    /*{
			"type": "input",
			"element": {
				"type": "plain_text_input",
				"multiline": true,
				"action_id": "plain_text_input-action"
			},
			"label": {
				"type": "plain_text",
				"text": "Anything you want to add?",
				"emoji": true
			}
		},*/
		{
			"type": "actions",
			"elements": [
				{
					"type": "button",
					"text": {
						"type": "plain_text",
						"text": "Submit",
						"emoji": true
					},
					"value": "click_me_123",
					"action_id": "submitted_response"
				}
			]
		}
	]



  let prompt_counter = 0
  try {

    const members = await app.client.conversations.members({
      token: process.env.SLACK_BOT_TOKEN,
      channel: channel_id
    })

      for(let i=0; i<members.members.length; i++) {
        //console.log(members.members[i])
        const user = await app.client.users.info({
          token: process.env.SLACK_BOT_TOKEN,
          user: members.members[i]
        })

        if(user.user.is_bot == false) {
          app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: members.members[i],
            blocks: blocks,
            text: botMessage
          })
          prompt_counter = prompt_counter + 1
        }
      }
  } catch (error) {
      console.log("err")
    console.error(error);
  }
// update the channel with a pulse request so that we can accept responses within the window
  await axios({
    method: 'post',
    url: 'http://localhost:8080/api/channel/pulserequest',
    params: {
      conversationId: channel_id,
      total_prompts_sent: prompt_counter,
      pulseId: pulseId
    }
  })
    .catch(err => console.log(err))

    await complete();
  },
});

app.step(ws)

app.action('submitted_response', async ({ body, client, ack, say }) => {
  await ack()
  //console.log(body.message.blocks)
  const responses = {
    one: body.state.values.responseOne['static_select-action'].selected_option.value,
    two: body.state.values.responseTwo['static_select-action'].selected_option.value,
    three: body.state.values.responseThree['static_select-action'].selected_option.value
  }
  let pulseId = body.message.blocks.map((block, i) => {
    if(block.type == 'divider') {
      return block.block_id
    }
  }) // returns array
  console.log(pulseId)
  pulseId = pulseId.filter(n => n)
  console.log(pulseId)
  pulseId = pulseId[0] // pulseId is now a lovely string
  console.log(pulseId)
  const response_url = body.response_url

  let metachannel = body.message.blocks.map((block, i) => {
    if(block.type == 'section') {
      return block.block_id
    } else {}
  }) // returns array

  metachannel = metachannel[0]

  console.log('channel is ' + metachannel)

  const user = body.user.id // User ID string

  axios({
    method: 'post',
    url: 'http://localhost:8080/api/user/pulseresponse',
    params: {
      conversationId: metachannel,
      user: user,
      score_one: responses.one,
      score_two: responses.two,
      score_three: responses.three,
      pulseId: pulseId
    }
  }).then((response) => {

    axios({
      method: 'get',
      url: 'http://localhost:8080/api/user/history',
      params: {
        conversationId: metachannel,
        user: user
      }
    }).then((res) => {
      console.log(res.data)
      console.log(body.message.blocks)
      const lineChartData = {
        labels: [], // dates of last four pulse requests
        q1data: {
          label: body.message.blocks.find(e => e.block_id == 'responseOne').label.text,
          responses: []
        },
        q2data: {
          label: body.message.blocks.find(e => e.block_id == 'responseTwo').label.text,
          responses: []
        },
        q3data: {
          label: body.message.blocks.find(e => e.block_id == 'responseThree').label.text,
          responses: []
        },
      }

      for(const d of res.data) {
        console.log(d.date)
        const date = d.date.slice(0,10)
        const one = d.score_one
        const two = d.score_two
        const three = d.score_three

        lineChartData.labels.push(date)
        lineChartData.q1data.responses.push(one)
        lineChartData.q2data.responses.push(two)
        lineChartData.q3data.responses.push(three)
      }

        const width = 640
        const height = 1136

        const configuration = {
          type: 'line',
          options: {
            scales: {
              y: {
                min: 1,
                max: 5
              }
            }
          },
          plugins: [{
      			id: 'background-colour',
      			beforeDraw: (chart) => {
      				const ctx = chart.ctx;
      				ctx.save();
      				ctx.fillStyle = 'white';
      				ctx.fillRect(0, 0, width, height);
      				ctx.restore();
      			}
      		}],
      		data: {
      			labels: lineChartData.labels, // dates of pulserequests
      			datasets: [{
      				label: lineChartData.q1data.label, // question 1
      				data: lineChartData.q1data.responses, // pulserequest responses to q1
              borderColor: 'red',
              backgroundColor: 'red',
              tension: 0.2,
      			},
            {
              label: lineChartData.q2data.label,
              data: lineChartData.q2data.responses,
              borderColor: 'blue',
              backgroundColor: 'blue',
              tension: 0.2,
            },
            {
              label: lineChartData.q3data.label,
              data: lineChartData.q3data.responses,
              borderColor: 'green',
              backgroundColor: 'green',
              tension: 0.2,
            }
          ]
          }
        }
        console.log(lineChartData)
        let filename = `${user}-${new Date().toISOString().slice(0, 10)}-pulsehistory.png`
        const chartJSNodeCanvas = new ChartJSNodeCanvas({width: width, height: width, backgroundColor: 'white' });

        const dataUrl = chartJSNodeCanvas.renderToBufferSync(configuration, 'image/png')

        const chart = fs.writeFileSync('./temp/' + filename, dataUrl, {
            encoding: "base64"
          },
          (err) => {
            if (err)
              {console.log(err);}
            else {
              console.log("File written successfully\n");
            }
        })

          const thanks = app.client.chat.delete({
            token: process.env.SLACK_BOT_TOKEN,
            channel: body.channel.id,
            ts: body.message.ts
          })
          say("Thank you for your response. Here's how you've been feeling over the last month.")

          app.client.files.upload({
            token: process.env.SLACK_BOT_TOKEN,
            channels: user,
            file: fs.createReadStream("./temp/" + filename),
            filename: filename
          }).then((response) => {
            if(response.ok == true) {
              console.log('File uploaded.')
              fs.unlink("./temp/" + filename, function(){
                console.log('Successfully deleted generated chart.')
              })
            }
            else {
              console.log(response)
            }
          })
    })
  })
  .catch((err) => {
    console.log(err)
    say('Whoops! Something went wrong when trying to save your response.')
  })
})

// Workflow Step to publish the weekly pulse
const publisher = new WorkflowStep('weekly_pulse_publisher', {
  edit: async ({ ack, step, configure }) => {
    await ack();
    console.log('editing weekly pulse publisher step')
    const blocks = [
      {
        type: 'section',
        block_id: 'publisher_1',
        text: {
          type: "mrkdwn",
          text: "This step will publish this week's team pulse. We recommend scheduling this step at least an hour after your 'Take the pulse of channel members' workflow."
        }
      },
      {
        type: 'input',
        block_id: 'channel_name_input7365',
        element: {
          type: 'plain_text_input',
          action_id: 'channel7365',
          multiline: false,
          placeholder: {
            type: 'plain_text',
            text: 'Choose insert variable and select \'Channel where workflow started\'',
          },
        },
        label: {
          type: 'plain_text',
          text: 'Channel',
        },
      },
    ];

    await configure({ blocks });
  },
  save: async ({ ack, step, view, update }) => {
    await ack();
    const { values } = view.state
    const channel = values.channel_name_input7365.channel7365


    const inputs = {
      channelName: {value: channel, skip_variable_replacement: false}
      }

    const outputs = [{
      type: 'channel',
      name: 'channel',
      label: 'Channel name'
    }]

    await update({ inputs, outputs });
  },
  execute: async ({ step, complete, fail }) => {
  const channelName = step.inputs.channelName.value.value
  const publishedMessage = `Here is this week's team pulse check.`
  try {
      app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channelName.replace(/<|#|>/g, ''),
        text: publishedMessage
      })
    } catch (error) {
        console.log("err")
      console.error(error);
    }
    await complete();
  },
});
app.step(publisher)

// listen for a command to start off the data gathering
// WARNING this function has become a testing ground
app.command("/takepulse", async ({ command, ack, say }) => {

      await ack();

      axios({
        method: 'get',
        url: 'http://localhost:8080/api/channel/pulse',
        params: {
          conversationId: command.channel_id,
        }
      }).then((response) => {
        const data = response.data

        const chartData = {
          q1: {
            max: Math.max(...data.q1),
            min: Math.min(...data.q1),
            avg: data.q1.reduce((a, b) => a + b, 0) / data.q1.length || 0
          },
          q2: {
            max: Math.max(...data.q2),
            min: Math.min(...data.q2),
            avg: data.q2.reduce((a, b) => a + b, 0) / data.q2.length || 0
          },
          q3: {
            max: Math.max(...data.q3),
            min: Math.min(...data.q3),
            avg: data.q3.reduce((a, b) => a + b, 0) / data.q3.length || 0
          },
        }

        console.log(chartData)

        const width = 640
        const height = 1136

        const configuration = {
          type: 'line',
          options: {
            scales: {
              y: {
                min: 1,
                max: 5
              }
            }
          },
          plugins: [{
      			//id: 'background-colour',
      			beforeDraw: (chart) => {
      				const ctx = chart.ctx;
      				ctx.save();
      				ctx.fillStyle = 'white';
      				ctx.fillRect(0, 0, width, height);
      				ctx.restore();
            },
    		   annotation: {
             drawTime: 'beforeDatasetsDraw',
             annotations: [
               {
                 type: 'line',
                 mode: 'vertical',
                 scaleID: 'x',
                 borderWidth: 10,
                 value: 'One',
                 yMin: chartData.q1.min,
                 yMax: chartData.q1.max,
                 borderColor: 'rgba(160,180,180,0.8)'
               },
               {
                 type: 'box',
                 xMin: 2,
                 xMax: 3,
                 yMin: chartData.q2.min,
                 yMax: chartData.q2.max,
                 backgroundColor: 'rgba(160,180,180,0.8)'
               },
               {
                 type: 'box',
                 xMin: 3,
                 xMax: 4,
                 yMin: chartData.q3.min,
                 yMax: chartData.q3.max,
                 backgroundColor: 'rgba(160,180,180,0.8)',
               }
             ]
           },
         }],
      		data: {
            xLabels: ['One', 'Two', 'Three'],
      			datasets: [{
      				label: 'Average',
      				data: [chartData.q1.avg, chartData.q2.avg, chartData.q3.avg],
              pointRadius: [20,20,20],
              backgroundColor: 'green',
              showLine: false
      			},
            {
      				label: 'Max',
      				data: [chartData.q1.max, chartData.q2.max, chartData.q3.max],
              pointRadius: [5,5,5],
              backgroundColor: 'grey',
              showLine: false
      			},
            {
      				label: 'Min',
      				data: [chartData.q1.min, chartData.q2.min, chartData.q3.min],
              pointRadius: [5,5,5],
              backgroundColor: 'grey',
              showLine: false
      			}
          ]
          }
        }

        let filename = `${new Date().toISOString().slice(0, 10)}-pulse.png`
        const chartJSNodeCanvas = new ChartJSNodeCanvas({width: width, height: height, plugins: {
          modern: [require('chartjs-plugin-annotation')]
        }});


        const dataUrl = chartJSNodeCanvas.renderToBufferSync(configuration, 'image/png')

        const chart = fs.writeFileSync('./temp/' + filename, dataUrl, {
            encoding: "base64"
          },
          (err) => {
            if (err)
              {console.log(err);}
            else {
              console.log("File written successfully\n");
            }
        })

          app.client.files.upload({
            token: process.env.SLACK_BOT_TOKEN,
            channels: command.channel_id, // swap out when put into cron!
            file: fs.createReadStream("./temp/" + filename),
            filename: filename
          }).then((response) => {
            if(response.ok == true) {
              console.log('File uploaded.')
              fs.unlink("./temp/" + filename, function(){
                console.log('Successfully deleted generated chart.')
              })
            }
            else {
              console.log(response)
            }
          })

      })

      /*(async () => {
        const configuration = {
          type: 'bar',
      		data: {
      			labels: ['Red', 'Blue', 'Yellow', 'Green', 'Purple', 'Orange'],
      			datasets: [{
      				label: '# of Votes',
      				data: [12, 19, 3, 5, 2, 3],
      				backgroundColor: [
      					'rgba(255, 99, 132, 0.2)',
      					'rgba(54, 162, 235, 0.2)',
      					'rgba(255, 206, 86, 0.2)',
      					'rgba(75, 192, 192, 0.2)',
      					'rgba(153, 102, 255, 0.2)',
      					'rgba(255, 159, 64, 0.2)'
      				],
      				borderColor: [
      					'rgba(255,99,132,1)',
      					'rgba(54, 162, 235, 1)',
      					'rgba(255, 206, 86, 1)',
      					'rgba(75, 192, 192, 1)',
      					'rgba(153, 102, 255, 1)',
      					'rgba(255, 159, 64, 1)'
      				],
      				borderWidth: 1
      			}]
          }
        }

        const chartJSNodeCanvas = new ChartJSNodeCanvas({width: 800, height: 600, backgroundColor: 'white' });

        const dataUrl = chartJSNodeCanvas.renderToBufferSync(configuration, 'image/png')

        const chart = await fs.writeFile('./temp/chart.png', dataUrl, {
            encoding: "base64"
          },
          (err) => {
            if (err)
              console.log(err);
            else {
              console.log("File written successfully\n");
            }
        })

          console.log(command)
          say("Thank you for your response. Here's how you've been feeling over the last month.")
          app.client.files.upload({
            token: process.env.SLACK_BOT_TOKEN,
            channels: command.channel_id,
            file: fs.createReadStream("./temp/chart.png"),
            filename: 'chart.png'
          }).then((response) => {
            if(response.ok == true) {
              console.log('File uploaded.')
            }
            else {
              console.log(response)
            }

          })




      })()






/*
      let theChannelName = 'charlietestgroup'

      const bots = app.client.users.conversations({
        token: process.env.SLACK_BOT_TOKEN,
        user: "U032DJ3BFE0",
        exclude_archived: true,
        types: "public_channel, private_channel, mpim"
      }).then((response) => {
        console.log(response.channels)
      })

      const channel_id = command.channel_id
      const members = app.client.conversations.members({
        token: process.env.SLACK_BOT_TOKEN,
        channel: channel_id
      }).then((response) => {
        for(let i=0; i<response.members.length; i++) {
          app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel: response.members[i],
            text: botPrompt
          })
        }
      })
    } catch (error) {
        console.log("err")
      console.error(error);
    }
    */
});




(async () => {
  const port = 3000
  // Start your app
  await app.start(process.env.PORT || port);
  console.log(`⚡️ Slack Bolt app is running on port ${port}!`);
})();

exp.listen(8080, () => {
  console.log('Express server is running on port 8080')
})
