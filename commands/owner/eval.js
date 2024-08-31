const { CommandInteraction, EmbedBuilder, ApplicationCommandOptionType } = require('discord.js');
const DUMMY_TOKEN = 'MY_TOKEN_IS_SECRET';
const config = require('../../config');

/**
 * @type {import("@structures/Command")}
 */
module.exports.data = {
  name: 'eval',
  description: 'Thực thi mã JavaScript',
  type: 1, // slash command
  options: [
    {
      name: 'code',
      description: 'Mã JavaScript để thực thi',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
  integration_types: [0],
  contexts: [0],
  global: false,
};

/**
 * @param { CommandInteraction } interaction
 */
module.exports.execute = async interaction => {
  if (interaction.user.id !== config.OwnerID) return;

  const code = interaction.options.getString('code');

  if (!code)
    return interaction.reply({
      content: 'Vui lòng cung cấp mã để thực thi.',
      ephemeral: true,
    });

  let response;
  try {
    const result = await eval(code);
    response = buildSuccessResponse(result, interaction.client);
  } catch (error) {
    response = buildErrorResponse(error);
  }

  await interaction.reply(response);
};

// Tạo phản hồi thành công
const buildSuccessResponse = (output, client) => {
  // Bảo vệ token
  output = require('util').inspect(output, { depth: 0 }).replace(client.token, DUMMY_TOKEN);

  const embed = new EmbedBuilder()
    .setAuthor({ name: '📤 Output' })
    .setDescription('```js\n' + (output.length > 4096 ? `${output.substring(0, 4000)}...` : output) + '\n```')
    .setColor('Random')
    .setTimestamp();

  return { embeds: [embed] };
};

// Tạo phản hồi lỗi
const buildErrorResponse = err => {
  const embed = new EmbedBuilder()
    .setAuthor({ name: '📤 Error' })
    .setDescription(
      '```js\n' + (err.message.length > 4096 ? `${err.message.substring(0, 4000)}...` : err.message) + '\n```'
    )
    .setColor('Random')
    .setTimestamp();

  return { embeds: [embed] };
};
